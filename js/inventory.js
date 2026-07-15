/* ============================================================
   inventory.js — fetches books from Firestore
   Falls back to seed-inventory.json if Firebase not configured.

   Firestore structure: /books/{bookId}
   Fields: id, title, isbn, subject, status, quantity, author, createdAt, updatedAt
   Status values: Available | Pending | Checked Out
   ============================================================ */

import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function normalizeBook(docSnap) {
  const data = docSnap.data();
  const parsedId = Number(data.id ?? docSnap.id);

  return {
    id: Number.isFinite(parsedId) ? parsedId : 0,
    title: data.title || '',
    isbn: data.isbn || '',
    subject: data.subject || 'Uncategorized',
    status: data.status || 'Available',
    quantity: Number.parseInt(data.quantity, 10) || 1,
    author: data.author || ''
  };
}

function compareBooks(a, b) {
  if (a.id && b.id && a.id !== b.id) {
    return a.id - b.id;
  }
  return a.title.localeCompare(b.title);
}

export async function fetchInventory() {
  // Try Firestore first
  if (db) {
    try {
      const booksRef = collection(db, 'books');
      const snapshot = await getDocs(booksRef);
      const books = snapshot.docs.map(normalizeBook).sort(compareBooks);

      console.log(`✓ Loaded ${books.length} books from Firestore`);
      return books;
    } catch (e) {
      console.warn('Could not fetch from Firestore, falling back to seed data.', e);
    }
  }

  // Fallback: seed inventory
  try {
    const res = await fetch('data/seed-inventory.json');
    const books = (await res.json()).sort(compareBooks);
    console.log(`✓ Loaded ${books.length} books from seed data (fallback)`);
    return books;
  } catch (e) {
    console.error('Failed to load seed inventory', e);
    return [];
  }
}

export function groupBySubject(books) {
  const map = {};
  for (const b of books) {
    const key = b.subject || 'Uncategorized';
    if (!map[key]) map[key] = [];
    map[key].push(b);
  }
  return map;
}

export function filterBooks(books, { search = '', subjects = [], availableOnly = false } = {}) {
  const q = search.trim().toLowerCase();
  return books.filter(b => {
    if (availableOnly && b.status !== 'Available') return false;
    if (subjects.length && !subjects.includes(b.subject)) return false;
    if (q) {
      const hay = `${b.title} ${b.isbn} ${b.author || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortBooks(books, key, direction = 'asc') {
  const sorted = [...books].sort((a, b) => {
    let va = (a[key] ?? '').toString().toLowerCase();
    let vb = (b[key] ?? '').toString().toLowerCase();
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  return direction === 'desc' ? sorted.reverse() : sorted;
}
