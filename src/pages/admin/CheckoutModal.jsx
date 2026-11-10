import { formatEdition } from './helpers.js';

export default function CheckoutModal({
  cart, books, total, submitting, onInc, onDec, onRemove, onScan, onSubmit, onClose
}) {
  const label = submitting
    ? 'Recording...'
    : total ? `Check out ${total} ${total === 1 ? 'book' : 'books'}` : 'Check out';

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <h3>Check Out Books</h3>
        <p className="modal__hint">Enter the person's details and submit. Each copy leaves the available inventory and is added to Copies given with today's date. Scan more books to add them to this checkout.</p>
        <div className="checkout-cart">
          {!total ? (
            <div className="empty-state">No books yet. Scan a barcode to add one.</div>
          ) : [...cart].map(([docId, count]) => {
            const book = books.find((candidate) => candidate.docId === docId);
            return (
              <div className="checkout-line" key={docId}>
                <div className="checkout-line__info">
                  <strong>{book?.title || 'Unknown book'}</strong>
                  <span>{formatEdition(book?.edition)} · {book ? book.quantity : 0} available</span>
                </div>
                <div className="checkout-line__qty">
                  <button type="button" className="btn btn--ghost btn--small" aria-label="One fewer copy" onClick={() => onDec(docId)}>−</button>
                  <span aria-label={`${count} copies`}>{count}</span>
                  <button type="button" className="btn btn--ghost btn--small" aria-label="One more copy" onClick={() => onInc(docId)}>+</button>
                  <button type="button" className="btn btn--ghost btn--small" aria-label="Remove from list" onClick={() => onRemove(docId)}>×</button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn--ghost checkout-scan" onClick={onScan}>Scan another book</button>
        <form onSubmit={onSubmit}>
          <div className="modal__field">
            <label htmlFor="checkout-name">Name *</label>
            <input type="text" id="checkout-name" name="name" required autoComplete="off" autoFocus />
          </div>
          <div className="modal__field">
            <label htmlFor="checkout-email">Email *</label>
            <input type="email" id="checkout-email" name="email" required autoComplete="off" />
          </div>
          <div className="modal__field">
            <label htmlFor="checkout-course">Course</label>
            <input type="text" id="checkout-course" name="course" autoComplete="off" placeholder="Optional" />
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--accent" disabled={total === 0 || submitting}>{label}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
