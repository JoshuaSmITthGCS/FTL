import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { filterBooks, sortBooks, formatEdition } from '../lib/inventory.js';
import { useInventory } from '../lib/useInventory.js';
import { useToast } from '../components/Toast.jsx';

export default function CatalogPage() {
  const toast = useToast();
  const { books, setBooks, loading } = useInventory();
  const [params] = useSearchParams();
  const preSubject = params.get('subject');

  const [search, setSearch] = useState('');
  const [subjects, setSubjects] = useState(preSubject ? [preSubject] : []);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'title', dir: 'asc' });
  const [currentBook, setCurrentBook] = useState(null);

  const subjectCounts = useMemo(() => {
    const counts = {};
    for (const b of books) counts[b.subject] = (counts[b.subject] || 0) + 1;
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }, [books]);

  const visible = useMemo(
    () => sortBooks(filterBooks(books, { search, subjects, availableOnly }), sort.key, sort.dir),
    [books, search, subjects, availableOnly, sort]
  );

  function toggleSort(key) {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }));
  }

  function sortClass(key) {
    if (sort.key !== key) return undefined;
    return sort.dir === 'asc' ? 'sort-asc' : 'sort-desc';
  }

  function reset() {
    setSearch('');
    setSubjects([]);
    setAvailableOnly(false);
  }

  function markPending(docId) {
    setBooks((prev) => prev.map((b) => (b.docId === docId ? { ...b, status: 'Pending' } : b)));
  }

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <div className="container">
          <div className="eyebrow">Browse · Search · Request</div>
          <h1>The Catalog</h1>
          <p>Every book currently on our shelf. Updated weekly by volunteers. Use the filters on the left to narrow by subject or search by title, author, edition, or ISBN.</p>
          <div className="catalog-meta">
            <div className="catalog-meta__count">
              {loading ? '—' : `${visible.length} ${visible.length === 1 ? 'book' : 'books'}`}
            </div>
            <div className="catalog-meta__updated">Updated from live inventory</div>
          </div>
        </div>
      </header>

      <div className="container">
        <div className="catalog-layout">
          <aside className="filters">
            <div className="filters__group">
              <h3>Search</h3>
              <input
                type="search"
                className="filters__search"
                placeholder="Title, edition, ISBN, author…"
                aria-label="Search the catalog"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filters__group">
              <h3>Availability</h3>
              <label className="filter-option">
                <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
                <span>Available only</span>
              </label>
            </div>

            <div className="filters__group">
              <h3>Subject</h3>
              <div>
                {subjectCounts.map(([subject, count]) => (
                  <label key={subject} className="filter-option">
                    <input
                      type="checkbox"
                      checked={subjects.includes(subject)}
                      onChange={(e) => setSubjects((prev) => (e.target.checked
                        ? [...prev, subject]
                        : prev.filter((s) => s !== subject)))}
                    />
                    <span>{subject}</span>
                    <span className="filter-option__count">{count}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="filters__reset" onClick={reset}>Reset filters</button>
          </aside>

          <section>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead>
                  <tr>
                    {[['title', 'Title'], ['edition', 'Edition'], ['subject', 'Subject'], ['isbn', 'ISBN'], ['status', 'Status']].map(([key, label]) => (
                      <th key={key} className={sortClass(key)} onClick={() => toggleSort(key)}>{label}</th>
                    ))}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" className="empty-state">Loading catalog…</td></tr>
                  ) : !visible.length ? (
                    <tr><td colSpan="6" className="empty-state">No books match those filters. Try clearing a filter or broadening your search.</td></tr>
                  ) : visible.map((b) => {
                    const canRequest = b.status === 'Available' && b.quantity > 0;
                    return (
                      <tr key={b.docId}>
                        <td data-label="Title"><div className="book-title">{b.title}</div></td>
                        <td data-label="Edition">{formatEdition(b.edition)}</td>
                        <td data-label="Subject"><span className="tag">{b.subject}</span></td>
                        <td data-label="ISBN"><span className="book-isbn">{b.isbn || '—'}</span></td>
                        <td data-label="Status">
                          <span className={`status ${canRequest ? 'status--available' : 'status--out'}`}>
                            {canRequest ? 'Available' : 'Unavailable'}
                          </span>
                        </td>
                        <td data-label="Action">
                          <button className="request-btn" disabled={!canRequest} onClick={() => setCurrentBook(b)}>
                            {canRequest ? 'Request' : 'Unavailable'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {currentBook && (
        <RequestModal
          book={currentBook}
          toast={toast}
          onClose={() => setCurrentBook(null)}
          onPending={markPending}
        />
      )}
    </div>
  );
}

function RequestModal({ book, toast, onClose, onPending }) {
  const [sending, setSending] = useState(false);

  async function submitToNetlify(formData) {
    const response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    });
    if (!response.ok) throw new Error(`Netlify form submission failed (${response.status})`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSending(true);

    try {
      if (db) {
        const bookDocId = book.docId || String(book.id);
        const requestData = {
          bookId: book.id,
          bookDocId,
          bookTitle: book.title || '',
          bookIsbn: book.isbn || '',
          bookAuthor: book.author || '',
          bookEdition: book.edition || '',
          bookSubject: book.subject || 'Uncategorized',
          course: formData.get('course') || '',
          name: formData.get('name') || '',
          email: formData.get('email') || '',
          message: formData.get('message') || '',
          availabilityRating: formData.get('availabilityRating') || '',
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const bookRef = doc(db, 'books', bookDocId);
        const requestRef = doc(collection(db, 'requests'));

        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(bookRef);
          if (!snapshot.exists()) throw new Error('book-not-found');
          const data = snapshot.data();
          const quantity = Number.parseInt(data.quantity, 10) || 0;
          if (data.status !== 'Available' || quantity < 1) throw new Error('book-unavailable');

          transaction.set(requestRef, requestData);
          transaction.update(bookRef, { status: 'Pending', updatedAt: serverTimestamp() });
        });

        onPending(bookDocId);

        await submitToNetlify(formData);
        toast('✓ Request sent successfully! A volunteer will email you within 48-72 hours.');
        onClose();
        return;
      }
    } catch (error) {
      console.error('Firestore submission error:', error);
      if (error.message === 'book-unavailable') {
        toast('Sorry — this book was just claimed by someone else. Please refresh and try another copy.');
        onClose();
        return;
      }
      // Fall through to mailto fallback
    }

    const subject = `Book request: ${book.title}`;
    const body = `Book: ${book.title}\nEdition: ${formatEdition(book.edition)}\nISBN: ${book.isbn || 'None'}\nAuthor(s): ${book.author || 'None'}\nSubject: ${book.subject}\nCourse: ${formData.get('course') || 'None'}\nAvailability Rating: ${formData.get('availabilityRating') || 'None'}\n\nName: ${formData.get('name')}\nEmail: ${formData.get('email')}\n\nNotes: ${formData.get('message') || 'None'}`;
    window.location.href = `mailto:freetextbooklibrary@cofc.edu?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast('Opening your email — send the message to finish the request.');
    onClose();
  }

  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Book Request — Free Textbook Library</h3>
        <p className="modal__intro">Please use this form to request a textbook from the Free Textbook Library. A student volunteer will contact you once the book is ready for pick-up.</p>
        <div className="modal__book">
          <strong>{book.title}</strong>
          {book.author && <div>Author: {book.author}</div>}
          <div>Edition: {formatEdition(book.edition)}</div>
          <div>{book.subject} · ISBN {book.isbn || 'n/a'}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="form-name" value="book-request" />
          <input type="hidden" name="bookTitle" value={book.title || ''} />
          <input type="hidden" name="bookIsbn" value={book.isbn || ''} />
          <input type="hidden" name="bookAuthor" value={book.author || ''} />
          <input type="hidden" name="bookEdition" value={book.edition || ''} />
          <input type="hidden" name="bookSubject" value={book.subject || ''} />
          <div className="modal__field">
            <label htmlFor="req-course">Course Name and Number (e.g., MATH 101, HIST 210)</label>
            <input type="text" id="req-course" name="course" placeholder="MATH 101, HIST 210" required />
          </div>
          <div className="modal__field">
            <label htmlFor="req-name">Your Name</label>
            <input type="text" id="req-name" name="name" required />
          </div>
          <div className="modal__field">
            <label htmlFor="req-email">CofC Email</label>
            <input type="email" id="req-email" name="email" required />
          </div>
          <div className="modal__field">
            <label htmlFor="req-msg">Notes (e.g., specific edition requirements, urgency, alternative contact method)</label>
            <textarea id="req-msg" name="message" rows="3" placeholder="Any additional information..."></textarea>
          </div>
          <fieldset className="modal__field modal__field--choice">
            <legend>How would you rate the availability of affordable textbooks currently?</legend>
            <div className="modal__scale-hint">
              <span>Very Poor</span>
              <span>Excellent</span>
            </div>
            <div className="modal__rating-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="modal__rating">
                  <input type="radio" name="availabilityRating" value={n} required={n === 1} />
                  <span>{n}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--accent" disabled={sending}>{sending ? 'Sending...' : 'Send request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
