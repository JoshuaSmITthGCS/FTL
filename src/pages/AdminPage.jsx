import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, doc, getDoc, onSnapshot, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp
} from 'firebase/firestore';
import { auth, db, firebaseProjectId } from '../lib/firebase.js';
import { scanIsbn, scanIsbnsContinuously, lookupIsbn, isbnMatches, suggestSubject, toIsbn13 } from '../lib/barcode-scanner.js';
import { useToast } from '../components/Toast.jsx';
import LoginScreen from './admin/LoginScreen.jsx';
import BookModal from './admin/BookModal.jsx';
import CheckoutModal from './admin/CheckoutModal.jsx';
import {
  DEFAULT_SUBJECTS, CUSTOM_SUBJECT_VALUE, MAX_CHECKOUT_COPIES,
  normalizeBookSnapshot, compareBooks, isGivenRequest, countGivenForBook, getTotalQuantity,
  getRequestBookValue, formatDate, formatEdition, normalizeSubject, getSubjectUsage, downloadUsageCsv
} from './admin/helpers.js';

const EMPTY_FORM = {
  title: '', isbn: '', author: '', edition: '', status: 'Available',
  quantity: 1, totalQuantity: 1, subjectSelect: 'Uncategorized', customSubject: ''
};

export default function AdminPage() {
  // undefined = still resolving, null = signed out
  const [user, setUser] = useState(undefined);
  const toast = useToast();

  useEffect(() => {
    if (!auth || !db) {
      console.warn('Firebase not configured');
      setUser(null);
      return undefined;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', nextUser.uid));
        if (adminDoc.exists() && adminDoc.data().isAdmin) {
          setUser(nextUser);
        } else {
          console.error('User is not an admin');
          toast('Access denied: You do not have admin privileges.');
          await signOut(auth);
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setUser(null);
      }
    });
  }, [toast]);

  return (
    <div className="admin-page">
      {user ? <Dashboard /> : user === null ? <LoginScreen /> : null}
    </div>
  );
}

function Dashboard() {
  const toast = useToast();
  const [books, setBooks] = useState([]);
  const [booksState, setBooksState] = useState('loading'); // loading | ready | error
  const [requests, setRequests] = useState([]);
  const [requestsState, setRequestsState] = useState('loading');
  const [booksCollapsed, setBooksCollapsed] = useState(false);

  // Scanner callbacks outlive a render, so they read the latest data through refs.
  const booksRef = useRef(books);
  const requestsRef = useRef(requests);
  booksRef.current = books;
  requestsRef.current = requests;

  useEffect(() => {
    const unsubBooks = onSnapshot(collection(db, 'books'), (snapshot) => {
      setBooks(snapshot.docs.map(normalizeBookSnapshot).sort(compareBooks));
      setBooksState('ready');
    }, (error) => {
      console.error('Error loading books:', error);
      setBooksState('error');
      toast('Could not connect to Firestore for books.');
    });
    const unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      setRequests(snapshot.docs.map((d) => ({ docId: d.id, ...d.data() })));
      setRequestsState('ready');
    }, (error) => {
      console.error('Error loading requests:', error);
      setRequestsState('error');
    });
    return () => { unsubBooks(); unsubRequests(); };
  }, [toast]);

  /* ---------- derived ---------- */
  const stats = useMemo(() => ({
    total: books.reduce((sum, book) => sum + getTotalQuantity(requests, book), 0),
    available: books.filter((b) => b.status === 'Available').reduce((sum, b) => sum + b.quantity, 0),
    given: requests.filter(isGivenRequest).length
  }), [books, requests]);

  const sortedRequests = useMemo(() => [...requests].sort((a, b) => {
    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  }), [requests]);
  const pendingRequests = sortedRequests.filter((r) => !r.status || r.status === 'pending');
  const givenRequests = sortedRequests.filter(isGivenRequest);
  const usage = useMemo(() => getSubjectUsage(books, requests), [books, requests]);

  const consoleRoot = firebaseProjectId
    ? `https://console.firebase.google.com/project/${firebaseProjectId}`
    : 'https://console.firebase.google.com/';

  /* ---------- book modal ---------- */
  const [bookModal, setBookModal] = useState(null); // null | { editingDocId }
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const totalRef = useRef(null);

  const subjectOptions = useMemo(() => {
    const subjects = new Set(DEFAULT_SUBJECTS);
    books.forEach((book) => { if (book.subject) subjects.add(book.subject); });
    return Array.from(subjects).sort((a, b) => a.localeCompare(b));
  }, [books]);

  const selectedSubject = (f) => (f.subjectSelect === CUSTOM_SUBJECT_VALUE
    ? normalizeSubject(f.customSubject)
    : normalizeSubject(f.subjectSelect) || 'Uncategorized');

  function openAddBookModal() {
    setBooksCollapsed(false);
    setForm(EMPTY_FORM);
    setBookModal({ editingDocId: null });
  }

  function openEditBookModal(docId) {
    setBooksCollapsed(false);
    const book = booksRef.current.find((b) => b.docId === docId);
    if (!book) return;
    setForm({
      title: book.title || '',
      isbn: book.isbn || '',
      author: book.author || '',
      edition: book.edition || '',
      status: ['Available', 'Pending', 'Unavailable'].includes(book.status)
        ? book.status
        : (book.quantity > 0 ? 'Available' : 'Unavailable'),
      quantity: book.quantity,
      totalQuantity: getTotalQuantity(requestsRef.current, book),
      subjectSelect: book.subject || 'Uncategorized',
      customSubject: ''
    });
    setBookModal({ editingDocId: docId });
  }

  const closeBookModal = useCallback(() => {
    setBookModal(null);
    setForm(EMPTY_FORM);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !document.querySelector('.scanner')) closeBookModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeBookModal]);

  // Clear the "total < available" validity message as soon as either number changes.
  useEffect(() => {
    totalRef.current?.setCustomValidity('');
  }, [form.quantity, form.totalQuantity]);

  const findBookByIsbn = (isbn, exceptDocId = null) =>
    booksRef.current.find((book) => book.docId !== exceptDocId && isbnMatches(book.isbn, isbn));

  // Fills ISBN, then title/author/subject from the lookup, without overwriting what's already typed.
  async function fillFormFromIsbn(isbn) {
    setForm((prev) => ({ ...prev, isbn }));

    const info = await lookupIsbn(isbn);
    if (!info?.title) {
      toast('ISBN filled in. No book details found, so enter the title manually.');
      document.getElementById('book-title')?.focus();
      return;
    }

    const known = [...new Set([...DEFAULT_SUBJECTS, ...booksRef.current.map((b) => b.subject).filter(Boolean)])];
    setForm((prev) => {
      const current = selectedSubject(prev);
      const suggested = !current || current === 'Uncategorized' ? suggestSubject(info.subjects, known) : '';
      return {
        ...prev,
        title: prev.title.trim() ? prev.title : info.title,
        author: prev.author.trim() ? prev.author : info.author,
        ...(suggested ? { subjectSelect: suggested, customSubject: '' } : {})
      };
    });
    toast(`Found "${info.title}". Check the details, then save.`);
  }

  // Header button: scan a book, then edit it if it exists or start a new entry if not.
  async function handleScanBook() {
    const isbn = await scanIsbn();
    if (!isbn) return;

    const existing = findBookByIsbn(isbn);
    if (existing) {
      toast(`"${existing.title}" is already in inventory. Opening it.`);
      openEditBookModal(existing.docId);
      return;
    }
    openAddBookModal();
    await fillFormFromIsbn(isbn);
  }

  // Modal button: scan into the form that is already open.
  async function handleScanIntoForm() {
    const isbn = await scanIsbn();
    if (!isbn) return;
    const duplicate = findBookByIsbn(isbn, bookModal?.editingDocId);
    if (duplicate) toast(`"${duplicate.title}" already has this ISBN. Edit that entry to change its copies.`);
    await fillFormFromIsbn(isbn);
  }

  async function handleBookFormSubmit(e) {
    e.preventDefault();
    if (!db) {
      toast('The admin connection is unavailable right now.');
      return;
    }

    const subject = selectedSubject(form);
    if (!subject) {
      toast('Choose a subject or enter a new one.');
      return;
    }

    const quantity = Math.max(0, parseInt(form.quantity, 10) || 0);
    const totalQuantity = Math.max(0, parseInt(form.totalQuantity, 10) || 0);
    const editingDocId = bookModal?.editingDocId ?? null;
    const editingBook = books.find((book) => book.docId === editingDocId);
    const copiesGiven = editingBook ? countGivenForBook(requests, editingBook.docId, editingBook.id) : 0;

    if (totalQuantity < quantity + copiesGiven) {
      const historyMessage = copiesGiven
        ? ` It must include the ${copiesGiven} ${copiesGiven === 1 ? 'copy' : 'copies'} already given.`
        : '';
      totalRef.current.setCustomValidity(`Total copies cannot be less than available copies.${historyMessage}`);
      totalRef.current.reportValidity();
      return;
    }

    const bookData = {
      title: form.title.trim(),
      isbn: form.isbn.trim(),
      author: form.author.trim(),
      edition: form.edition.trim(),
      subject,
      status: quantity === 0 ? 'Unavailable' : form.status,
      quantity,
      totalQuantity,
      updatedAt: serverTimestamp()
    };

    setSaving(true);
    try {
      if (editingDocId !== null) {
        await updateDoc(doc(db, 'books', editingDocId), bookData);
        toast('Book updated successfully');
      } else {
        const nextId = books.reduce((max, book) => Math.max(max, book.id || 0), 0) + 1;
        await setDoc(doc(db, 'books', String(nextId)), { ...bookData, id: nextId, createdAt: serverTimestamp() });
        toast('Book added successfully');
      }
      closeBookModal();
    } catch (error) {
      console.error('Error saving book:', error);
      toast(error.code === 'permission-denied'
        ? 'Firebase rejected that change. Check the admin user permissions.'
        : 'Error saving book. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBook(docId) {
    const book = books.find((b) => b.docId === docId);
    if (!book) return;
    if (!window.confirm(`Are you sure you want to delete "${book.title}"? This cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'books', docId));
      toast('Book deleted successfully');
    } catch (error) {
      console.error('Error deleting book:', error);
      toast(error.code === 'permission-denied'
        ? 'Firebase rejected that delete. Check the admin user permissions.'
        : 'Error deleting book. Please try again.');
    }
  }

  /* ---------- bulk scan ---------- */
  async function addCopyToBook(bookDocId) {
    await runTransaction(db, async (transaction) => {
      const bookRef = doc(db, 'books', bookDocId);
      const snapshot = await transaction.get(bookRef);
      if (!snapshot.exists()) throw new Error('book-not-found');

      const book = snapshot.data();
      const quantity = Math.max(0, Number.parseInt(book.quantity, 10) || 0);
      const total = Math.max(quantity, Number.parseInt(book.totalQuantity, 10) || quantity);
      transaction.update(bookRef, {
        quantity: quantity + 1,
        totalQuantity: total + 1,
        status: book.status === 'Unavailable' ? 'Available' : book.status,
        updatedAt: serverTimestamp()
      });
    });
  }

  async function processBulkIsbn(isbn, session) {
    const key = toIsbn13(isbn);
    const known = session.added.get(key) || (() => {
      const book = findBookByIsbn(isbn);
      return book ? { docId: book.docId, title: book.title } : null;
    })();

    if (known) {
      await addCopyToBook(known.docId);
      session.counts.copy += 1;
      return { kind: 'copy', title: known.title, message: '+1 copy' };
    }

    const info = await lookupIsbn(isbn);
    const knownSubjects = [...new Set([...DEFAULT_SUBJECTS, ...booksRef.current.map((b) => b.subject).filter(Boolean)])];
    const subject = suggestSubject(info?.subjects, knownSubjects) || 'Uncategorized';
    const title = info?.title || `Unknown title (ISBN ${isbn})`;

    while (booksRef.current.some((book) => book.id === session.nextId || book.docId === String(session.nextId))) {
      session.nextId += 1;
    }
    const id = session.nextId++;

    await setDoc(doc(db, 'books', String(id)), {
      id, title, isbn: key, author: info?.author || '', edition: '', subject,
      status: 'Available', quantity: 1, totalQuantity: 1,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    session.added.set(key, { docId: String(id), title });

    if (!info?.title) {
      session.counts.unknown += 1;
      return { kind: 'unknown', title, message: 'Added. No details found, edit the title later.' };
    }
    session.counts.added += 1;
    return { kind: 'added', title, message: `Added · ${subject}` };
  }

  // Bulk mode: keep the camera open. A known book gets +1 copy; an unknown book is created
  // with whatever the lookup finds, so a whole box can be entered without touching the form.
  async function handleBulkScan() {
    const session = {
      added: new Map(), // ISBN-13 -> { docId, title } for books created during this session
      nextId: booksRef.current.reduce((max, book) => Math.max(max, book.id || 0), 0) + 1,
      counts: { added: 0, copy: 0, unknown: 0 }
    };

    const scanned = await scanIsbnsContinuously((isbn) => processBulkIsbn(isbn, session));
    if (!scanned) return;

    const { added, copy, unknown } = session.counts;
    const parts = [`${added} new`, `${copy} extra ${copy === 1 ? 'copy' : 'copies'}`];
    if (unknown) parts.push(`${unknown} need a title`);
    toast(`Bulk scan done: ${parts.join(', ')}.`, 6000);
  }

  /* ---------- checkout ---------- */
  const cartRef = useRef(new Map()); // book docId -> copies; the scanner reads it synchronously
  const [cart, setCartState] = useState(new Map());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const setCart = (next) => {
    cartRef.current = next;
    setCartState(new Map(next));
  };
  const cartTotal = () => [...cartRef.current.values()].reduce((sum, count) => sum + count, 0);

  async function handleCheckoutScan({ stopOnFirst = false } = {}) {
    await scanIsbnsContinuously(async (isbn) => {
      const matches = booksRef.current.filter((book) => isbnMatches(book.isbn, isbn));
      if (!matches.length) return { kind: 'error', title: `ISBN ${isbn}`, message: 'Not in inventory' };

      const current = cartRef.current;
      // With duplicate entries for one ISBN, take the first that still has copies left.
      const book = matches.find((c) => (current.get(c.docId) || 0) < c.quantity) || matches[0];
      const count = current.get(book.docId) || 0;
      if (book.quantity < 1) return { kind: 'error', title: book.title, message: 'No copies available' };
      if (count >= book.quantity) {
        return { kind: 'error', title: book.title, message: `Only ${book.quantity} available, all already in the list` };
      }
      if (cartTotal() >= MAX_CHECKOUT_COPIES) {
        return { kind: 'error', title: book.title, message: `Limit of ${MAX_CHECKOUT_COPIES} books per checkout` };
      }

      const next = new Map(current);
      next.set(book.docId, count + 1);
      setCart(next);
      return { kind: 'copy', title: book.title, message: `In list (${count + 1})`, stop: stopOnFirst };
    });
  }

  // The scanner opens first. The first available book scanned closes it and opens the
  // name/email form with that book already listed; more books can be scanned from the form.
  async function startCheckout() {
    setCart(new Map());
    await handleCheckoutScan({ stopOnFirst: true });
    if (cartRef.current.size) setCheckoutOpen(true);
  }

  function closeCheckoutModal() {
    setCheckoutOpen(false);
    setCart(new Map());
  }

  function cartInc(docId) {
    const book = booksRef.current.find((c) => c.docId === docId);
    const count = cartRef.current.get(docId) || 0;
    if (!book || count >= book.quantity) {
      toast(`Only ${book?.quantity || 0} available.`);
    } else if (cartTotal() >= MAX_CHECKOUT_COPIES) {
      toast(`One checkout is limited to ${MAX_CHECKOUT_COPIES} books.`);
    } else {
      const next = new Map(cartRef.current);
      next.set(docId, count + 1);
      setCart(next);
    }
  }

  function cartDec(docId) {
    const next = new Map(cartRef.current);
    const n = (next.get(docId) || 0) - 1;
    if (n < 1) next.delete(docId); else next.set(docId, n);
    setCart(next);
  }

  function cartRemove(docId) {
    const next = new Map(cartRef.current);
    next.delete(docId);
    setCart(next);
  }

  async function handleCheckoutSubmit(event) {
    event.preventDefault();
    if (!cartRef.current.size) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const course = String(formData.get('course') || '').trim();
    const lines = [...cartRef.current].map(([docId, count]) => ({ docId, count }));
    const totalCopies = cartTotal();

    setCheckingOut(true);
    try {
      // One transaction: either every copy is recorded or none are.
      await runTransaction(db, async (transaction) => {
        const bookRefs = lines.map((line) => doc(db, 'books', line.docId));
        const snapshots = await Promise.all(bookRefs.map((ref) => transaction.get(ref)));

        const updates = snapshots.map((snapshot, index) => {
          const { docId, count } = lines[index];
          const cached = booksRef.current.find((book) => book.docId === docId);
          if (!snapshot.exists()) throw Object.assign(new Error('book-not-found'), { bookTitle: cached?.title });

          const book = snapshot.data();
          const quantity = Math.max(0, Number.parseInt(book.quantity, 10) || 0);
          if (quantity < count) throw Object.assign(new Error('out-of-stock'), { bookTitle: book.title });

          const copiesAlreadyGiven = countGivenForBook(requestsRef.current, docId, book.id);
          const storedTotal = Number.parseInt(book.totalQuantity, 10);
          const totalQuantity = Number.isFinite(storedTotal)
            ? Math.max(quantity + copiesAlreadyGiven, storedTotal)
            : quantity + copiesAlreadyGiven;
          return { docId, count, book, quantity, totalQuantity };
        });

        updates.forEach(({ docId, count, book, quantity, totalQuantity }, index) => {
          const nextQuantity = quantity - count;
          transaction.update(bookRefs[index], {
            quantity: nextQuantity,
            totalQuantity,
            status: nextQuantity === 0 ? 'Unavailable' : (book.status === 'Pending' ? 'Pending' : 'Available'),
            updatedAt: serverTimestamp()
          });

          // One record per copy, so Copies given and the usage report count every book.
          for (let copy = 0; copy < count; copy += 1) {
            transaction.set(doc(collection(db, 'requests')), {
              bookId: book.id ?? Number(docId) ?? 0,
              bookDocId: docId,
              bookTitle: book.title || '',
              bookIsbn: book.isbn || '',
              bookAuthor: book.author || '',
              bookEdition: book.edition || '',
              bookSubject: book.subject || 'Uncategorized',
              course, name, email,
              message: '',
              source: 'in-person checkout',
              status: 'given',
              createdAt: serverTimestamp(),
              givenAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        });
      });

      toast(`Checked out ${totalCopies} ${totalCopies === 1 ? 'book' : 'books'} to ${name}.`, 5000);
      closeCheckoutModal();
    } catch (error) {
      console.error('Could not record checkout:', error);
      const title = error.bookTitle ? `"${error.bookTitle}"` : 'A book';
      const messages = {
        'out-of-stock': `${title} doesn't have enough copies left. Nothing was recorded.`,
        'book-not-found': `${title} is no longer in inventory. Nothing was recorded.`
      };
      toast(messages[error.message] || (error.code === 'permission-denied'
        ? 'Firebase rejected the checkout. The updated Firestore rules may not be deployed yet.'
        : 'Could not record the checkout. Nothing was saved. Please try again.'), 6000);
    } finally {
      setCheckingOut(false);
    }
  }

  /* ---------- requests ---------- */
  const [busyRequest, setBusyRequest] = useState(null); // { id, action }

  function findBookDocId(request) {
    const match = booksRef.current.find((book) =>
      book.docId === request.bookDocId || book.id === Number(request.bookId));
    return request.bookDocId || match?.docId || String(request.bookId || '');
  }

  async function handleGiveRequest(requestDocId) {
    if (busyRequest) return;
    setBusyRequest({ id: requestDocId, action: 'give' });
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'requests', requestDocId);
        const requestSnapshot = await transaction.get(requestRef);
        if (!requestSnapshot.exists()) throw new Error('request-not-found');

        const request = requestSnapshot.data();
        if ((request.status || 'pending') !== 'pending') throw new Error('request-already-updated');

        const bookDocId = findBookDocId(request);
        if (!bookDocId) throw new Error('book-not-found');

        const bookRef = doc(db, 'books', bookDocId);
        const bookSnapshot = await transaction.get(bookRef);
        if (!bookSnapshot.exists()) throw new Error('book-not-found');

        const book = bookSnapshot.data();
        const quantity = Math.max(0, Number.parseInt(book.quantity, 10) || 0);
        const copiesAlreadyGiven = countGivenForBook(requestsRef.current, bookDocId, request.bookId);
        const storedTotal = Number.parseInt(book.totalQuantity, 10);
        const totalQuantity = Number.isFinite(storedTotal)
          ? Math.max(quantity + copiesAlreadyGiven, storedTotal)
          : quantity + copiesAlreadyGiven;

        if (quantity < 1) throw new Error('out-of-stock');
        const nextQuantity = quantity - 1;
        transaction.update(bookRef, {
          quantity: nextQuantity,
          totalQuantity,
          status: nextQuantity === 0 ? 'Unavailable' : 'Available',
          updatedAt: serverTimestamp()
        });
        transaction.update(requestRef, {
          status: 'given',
          bookDocId,
          bookEdition: request.bookEdition || book.edition || '',
          bookSubject: request.bookSubject || book.subject || 'Uncategorized',
          givenAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      toast('Copy given. Inventory and usage reporting were updated.');
    } catch (error) {
      console.error('Could not record copy given:', error);
      const messages = {
        'out-of-stock': 'This book has no available copies. Nothing was recorded as given.',
        'book-not-found': 'The matching book could not be found in inventory.',
        'request-not-found': 'That request no longer exists.',
        'request-already-updated': 'That request was already updated by another volunteer.'
      };
      toast(messages[error.message] || 'Could not record the copy. Please try again.');
    } finally {
      setBusyRequest(null);
    }
  }

  async function handleDeclineRequest(requestDocId) {
    if (busyRequest) return;
    setBusyRequest({ id: requestDocId, action: 'decline' });
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'requests', requestDocId);
        const requestSnapshot = await transaction.get(requestRef);
        if (!requestSnapshot.exists()) throw new Error('request-not-found');

        const request = requestSnapshot.data();
        if ((request.status || 'pending') !== 'pending') throw new Error('request-already-updated');

        const bookDocId = findBookDocId(request);
        if (bookDocId) {
          const bookRef = doc(db, 'books', bookDocId);
          const bookSnapshot = await transaction.get(bookRef);
          if (bookSnapshot.exists()) {
            const book = bookSnapshot.data();
            const quantity = Math.max(0, Number.parseInt(book.quantity, 10) || 0);
            if (book.status === 'Pending') {
              transaction.update(bookRef, {
                status: quantity === 0 ? 'Unavailable' : 'Available',
                updatedAt: serverTimestamp()
              });
            }
          }
        }

        transaction.update(requestRef, {
          status: 'declined',
          declinedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      toast('Request declined. The book is available again.');
    } catch (error) {
      console.error('Could not decline request:', error);
      const messages = {
        'request-not-found': 'That request no longer exists.',
        'request-already-updated': 'That request was already updated by another volunteer.'
      };
      toast(messages[error.message] || 'Could not decline the request. Please try again.');
    } finally {
      setBusyRequest(null);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      toast('Signed out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast('Error signing out');
    }
  }

  function handleExport() {
    if (!requests.some(isGivenRequest)) {
      toast('There is no usage data to export yet.');
      return;
    }
    downloadUsageCsv(books, requests);
    toast('Usage CSV downloaded. It can be opened in Google Sheets or Excel.');
  }

  /* ---------- render ---------- */
  const bookValue = (request, requestField, bookField) => getRequestBookValue(books, request, requestField, bookField);

  function renderRequestTable(rows, showAction) {
    return (
      <table className="request-queue">
        <thead>
          <tr><th>Book</th><th>Edition</th><th>Student</th><th>Email</th><th>Course</th><th>Date</th><th>{showAction ? 'Action' : 'Status'}</th></tr>
        </thead>
        <tbody>
          {rows.map((request) => {
            const timestamp = showAction ? request.createdAt : (request.givenAt || request.fulfilledAt || request.createdAt);
            const busy = busyRequest?.id === request.docId;
            return (
              <tr key={request.docId}>
                <td><strong>{request.bookTitle || 'Unknown'}</strong></td>
                <td>{formatEdition(bookValue(request, 'bookEdition', 'edition'))}</td>
                <td>{request.name || 'N/A'}</td>
                <td>{request.email || 'N/A'}</td>
                <td>{request.course || 'N/A'}</td>
                <td>{formatDate(timestamp)}</td>
                <td className="request-queue__action">
                  {showAction ? (
                    <>
                      <button className="btn btn--accent btn--small" disabled={busy} onClick={() => handleGiveRequest(request.docId)}>
                        {busy && busyRequest.action === 'give' ? 'Recording...' : 'Mark copy given'}
                      </button>
                      <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => handleDeclineRequest(request.docId)}>
                        {busy && busyRequest.action === 'decline' ? 'Declining...' : 'Decline'}
                      </button>
                    </>
                  ) : <span className="status status--available">Given</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  const requestsError = requestsState === 'error';
  const totalUsage = usage.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="container">
      <div className="admin-header">
        <div>
          <div className="eyebrow">Volunteer Dashboard</div>
          <h1>Inventory &amp; Requests</h1>
        </div>
        <button className="admin-logout" onClick={handleLogout}>Sign out →</button>
      </div>

      <div className="admin-grid">
        <div className="admin-stat">
          <div className="admin-stat__label">Copies Recorded</div>
          <div className="admin-stat__value">{stats.total}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__label">Copies Available</div>
          <div className="admin-stat__value">{stats.available}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__label">Copies Given</div>
          <div className="admin-stat__value">{stats.given}</div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Firebase tools</h2>
        <p>The dashboard below syncs directly with <strong>Firestore</strong>. These links open the Firebase Console for advanced maintenance when you need it.</p>
        <div className="admin-link-grid">
          <a className="admin-link" target="_blank" rel="noopener" href={`${consoleRoot}/firestore/data/~2Fbooks`}>
            <strong>Open Firestore Books →</strong>
            <span>Inspect the raw `/books` collection in Firebase Console</span>
          </a>
          <a className="admin-link" target="_blank" rel="noopener" href={`${consoleRoot}/authentication/users`}>
            <strong>Open Auth Users →</strong>
            <span>Manage the admin login account in Firebase Authentication</span>
          </a>
          <a className="admin-link" target="_blank" rel="noopener" href={`${consoleRoot}/firestore/data/~2Frequests`}>
            <strong>Open Firestore Requests →</strong>
            <span>Inspect the live `/requests` collection in Firebase Console</span>
          </a>
          <Link className="admin-link" to="/catalog">
            <strong>View Public Catalog →</strong>
            <span>See what students see</span>
          </Link>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section__header">
          <h2>Manage Books</h2>
          <div className="admin-section__actions">
            <button
              type="button" className="btn btn--ghost admin-section__toggle"
              aria-expanded={!booksCollapsed} aria-controls="manage-books-panel"
              onClick={() => setBooksCollapsed((v) => !v)}
            >
              {booksCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={startCheckout}>Check Out</button>
            <button type="button" className="btn btn--ghost" onClick={handleBulkScan}>Bulk Scan</button>
            <button type="button" className="btn btn--ghost" onClick={handleScanBook}>Scan Book</button>
            <button className="btn btn--accent" onClick={openAddBookModal}>+ Add Book</button>
          </div>
        </div>
        <div className="admin-section__content" id="manage-books-panel" hidden={booksCollapsed}>
          <p>Add, edit, or remove books from the catalog. Changes are saved to Firestore and sync back into this table automatically.</p>
          <div>
            {booksState === 'loading' ? <div className="empty-state">Loading books...</div>
              : booksState === 'error' ? <div className="empty-state">Could not load books from Firestore.</div>
              : !books.length ? <div className="empty-state">No books in inventory.</div>
              : (
                <table className="request-queue">
                  <thead>
                    <tr><th>Title</th><th>Edition</th><th>Subject</th><th>ISBN</th><th>Author</th><th>Status</th><th>Available / Recorded</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {books.map((b) => {
                      const statusClass = b.status === 'Available' ? 'status--available'
                        : b.status === 'Pending' ? 'status--pending' : 'status--out';
                      const total = getTotalQuantity(requests, b);
                      return (
                        <tr key={b.docId}>
                          <td><strong>{b.title}</strong></td>
                          <td>{formatEdition(b.edition)}</td>
                          <td>{b.subject}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{b.isbn || '—'}</td>
                          <td>{b.author || '—'}</td>
                          <td><span className={`status ${statusClass}`}>{b.status}</span></td>
                          <td><span className="quantity-fraction" aria-label={`${b.quantity} available out of ${total} total`}>{b.quantity} / {total}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn--ghost btn--small" onClick={() => openEditBookModal(b.docId)}>Edit</button>
                            <button className="btn btn--ghost btn--small" onClick={() => handleDeleteBook(b.docId)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Pending requests</h2>
        <p>When a student picks up a book, mark one copy given. The copy leaves the available inventory permanently and the student is added to the usage report.</p>
        <div>
          {requestsError ? <div className="empty-state">Error loading requests.</div>
            : !pendingRequests.length ? <div className="empty-state">{requestsState === 'loading' ? 'No requests yet.' : 'No pending requests.'}</div>
            : renderRequestTable(pendingRequests, true)}
        </div>
      </div>

      <div className="admin-section">
        <h2>Copies given</h2>
        <p>A permanent history of books students received. These copies are not expected back.</p>
        <div>
          {requestsError ? <div className="empty-state">Error loading copies given.</div>
            : !givenRequests.length ? <div className="empty-state">No copies have been given yet.</div>
            : renderRequestTable(givenRequests, false)}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section__header">
          <div>
            <h2>Subject usage</h2>
            <p>See which subjects students take most, based on copies marked given.</p>
          </div>
          <button type="button" className="btn btn--ghost" disabled={!usage.length} onClick={handleExport}>Export usage CSV</button>
        </div>
        <div>
          {requestsError ? <div className="empty-state">Error loading usage data.</div>
            : !usage.length ? <div className="empty-state">No usage data yet. Subjects appear here after a copy is marked given.</div>
            : (
              <table className="request-queue usage-table">
                <thead><tr><th>Rank</th><th>Subject</th><th>Copies given</th><th>Share</th></tr></thead>
                <tbody>
                  {usage.map((item, index) => (
                    <tr key={item.subject}>
                      <td><span className="usage-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span></td>
                      <td><strong>{item.subject}</strong></td>
                      <td><span className="quantity-fraction">{item.count}</span></td>
                      <td>{Math.round((item.count / totalUsage) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {bookModal && (
        <BookModal
          title={bookModal.editingDocId === null ? 'Add Book' : 'Edit Book'}
          form={form}
          setForm={setForm}
          subjectOptions={subjectOptions}
          saving={saving}
          totalRef={totalRef}
          onScanIsbn={handleScanIntoForm}
          onSubmit={handleBookFormSubmit}
          onClose={closeBookModal}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          books={books}
          total={[...cart.values()].reduce((sum, count) => sum + count, 0)}
          submitting={checkingOut}
          onInc={cartInc}
          onDec={cartDec}
          onRemove={cartRemove}
          onScan={() => handleCheckoutScan()}
          onSubmit={handleCheckoutSubmit}
          onClose={closeCheckoutModal}
        />
      )}
    </section>
  );
}
