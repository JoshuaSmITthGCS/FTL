import { formatEdition } from '../../lib/inventory.js';

export { formatEdition };

export const ADMIN_EMAIL = 'admin@freetextbooklibrary.local';
export const DEFAULT_SUBJECTS = ['Business', 'English', 'Entertainment', 'History', 'Humanities', 'Language', 'Uncategorized'];
export const CUSTOM_SUBJECT_VALUE = '__custom__';
export const MAX_CHECKOUT_COPIES = 300; // keeps one transaction under Firestore's 500-write limit

export function normalizeBookSnapshot(bookDoc) {
  const data = bookDoc.data();
  const parsedId = Number(data.id ?? bookDoc.id);
  const parsedQuantity = Number.parseInt(data.quantity, 10);
  const quantity = Number.isFinite(parsedQuantity) ? Math.max(0, parsedQuantity) : 1;
  const parsedTotalQuantity = Number.parseInt(data.totalQuantity, 10);

  return {
    docId: bookDoc.id,
    id: Number.isFinite(parsedId) ? parsedId : 0,
    title: data.title || '',
    isbn: data.isbn || '',
    author: data.author || '',
    edition: data.edition || '',
    subject: data.subject || 'Uncategorized',
    status: data.status || 'Available',
    quantity,
    totalQuantity: Number.isFinite(parsedTotalQuantity)
      ? Math.max(quantity, parsedTotalQuantity)
      : quantity
  };
}

export function compareBooks(a, b) {
  if (a.id && b.id && a.id !== b.id) return a.id - b.id;
  return a.title.localeCompare(b.title);
}

export function isGivenRequest(request) {
  return request.status === 'given' || request.status === 'fulfilled';
}

export function countGivenForBook(requests, bookDocId, numericBookId) {
  return requests.filter((request) =>
    isGivenRequest(request) && (
      request.bookDocId === bookDocId ||
      Number(request.bookId) === Number(numericBookId)
    )
  ).length;
}

export function getTotalQuantity(requests, book) {
  const copiesGiven = countGivenForBook(requests, book.docId, book.id);
  return Math.max(book.totalQuantity || 0, book.quantity + copiesGiven);
}

export function getRequestBookValue(books, request, requestField, bookField) {
  if (request[requestField]) return request[requestField];
  const book = books.find((candidate) =>
    candidate.docId === request.bookDocId || candidate.id === Number(request.bookId)
  );
  return book?.[bookField] || '';
}

export function timestampMillis(timestamp) {
  if (timestamp?.toMillis) return timestamp.toMillis();
  const parsed = new Date(timestamp || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(timestamp) {
  if (timestamp?.toDate) return timestamp.toDate().toLocaleDateString();
  const parsed = new Date(timestamp || 0);
  return Number.isNaN(parsed.getTime()) || !timestamp ? 'N/A' : parsed.toLocaleDateString();
}

export function normalizeSubject(subject) {
  return String(subject || '').trim().replace(/\s+/g, ' ');
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function getSubjectUsage(books, requests) {
  const counts = new Map();
  requests.filter(isGivenRequest).forEach((request) => {
    const subject = getRequestBookValue(books, request, 'bookSubject', 'subject') || 'Uncategorized';
    counts.set(subject, (counts.get(subject) || 0) + 1);
  });
  return Array.from(counts, ([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
}

export function downloadUsageCsv(books, requests) {
  const givenRequests = requests.filter(isGivenRequest);
  const summaryRows = [
    ['Subject', 'Copies Given'],
    ...getSubjectUsage(books, requests).map((item) => [item.subject, item.count]),
    [],
    ['Date Given', 'Subject', 'Book', 'Edition', 'ISBN', 'Course', 'Student', 'Email', 'Request ID']
  ];
  const detailRows = [...givenRequests]
    .sort((a, b) => timestampMillis(b.givenAt || b.fulfilledAt) - timestampMillis(a.givenAt || a.fulfilledAt))
    .map((request) => [
      formatDate(request.givenAt || request.fulfilledAt || request.createdAt),
      getRequestBookValue(books, request, 'bookSubject', 'subject') || 'Uncategorized',
      request.bookTitle || 'Unknown',
      formatEdition(getRequestBookValue(books, request, 'bookEdition', 'edition')),
      request.bookIsbn || '',
      request.course || '',
      request.name || '',
      request.email || '',
      request.docId
    ]);
  const csv = [...summaryRows, ...detailRows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `textbook-library-usage-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
