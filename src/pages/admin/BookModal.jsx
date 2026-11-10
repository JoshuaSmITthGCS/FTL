import { useEffect, useRef } from 'react';
import { CUSTOM_SUBJECT_VALUE } from './helpers.js';

// Presentational: AdminPage owns the form state so scan/lookup can fill it in.
export default function BookModal({
  title, form, setForm, subjectOptions, saving, minimumTotalError,
  onScanIsbn, onSubmit, onClose, totalRef
}) {
  const customRef = useRef(null);
  const isCustom = form.subjectSelect === CUSTOM_SUBJECT_VALUE;

  useEffect(() => {
    if (isCustom) customRef.current?.focus();
  }, [isCustom]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>{title}</h3>
        <form onSubmit={onSubmit}>
          <div className="modal__field">
            <label htmlFor="book-title">Title *</label>
            <input type="text" id="book-title" name="title" required value={form.title} onChange={set('title')} />
          </div>
          <div className="modal__field">
            <label htmlFor="book-isbn">ISBN</label>
            <div className="modal__inline">
              <input type="text" id="book-isbn" name="isbn" inputMode="numeric" value={form.isbn} onChange={set('isbn')} />
              <button type="button" className="btn btn--ghost" onClick={onScanIsbn}>Scan</button>
            </div>
            <p className="modal__hint">Scan the barcode on the back cover to fill in the ISBN, title, and author.</p>
          </div>
          <div className="modal__field">
            <label htmlFor="book-author">Author</label>
            <input type="text" id="book-author" name="author" value={form.author} onChange={set('author')} />
          </div>
          <div className="modal__field">
            <label htmlFor="book-edition">Edition</label>
            <input type="text" id="book-edition" name="edition" placeholder="e.g., 4th" value={form.edition} onChange={set('edition')} />
            <p className="modal__hint">Students will see this in the public catalog.</p>
          </div>
          <div className="modal__field">
            <label htmlFor="book-subject-select">Subject *</label>
            <select id="book-subject-select" required value={form.subjectSelect} onChange={set('subjectSelect')}>
              {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              <option value={CUSTOM_SUBJECT_VALUE}>Add new subject...</option>
            </select>
            <p className="modal__hint">Choose an existing subject or select "Add new subject..." to create one.</p>
          </div>
          <div className={`modal__field${isCustom ? '' : ' modal__field--hidden'}`}>
            <label htmlFor="book-subject-custom">New Subject *</label>
            <input
              type="text"
              id="book-subject-custom"
              ref={customRef}
              placeholder="Enter a new subject"
              required={isCustom}
              value={form.customSubject}
              onChange={set('customSubject')}
            />
          </div>
          <div className="modal__field">
            <label htmlFor="book-status">Status *</label>
            <select id="book-status" name="status" required value={form.status} onChange={set('status')}>
              <option value="Available">Available</option>
              <option value="Pending">Pending</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>
          <div className="modal__field">
            <label htmlFor="book-quantity">Available copies *</label>
            <input
              type="number" id="book-quantity" name="quantity" min="0" required
              value={form.quantity} onChange={set('quantity')}
            />
            <p className="modal__hint">Copies currently on the shelf and available to request.</p>
          </div>
          <div className="modal__field">
            <label htmlFor="book-total-quantity">Total copies *</label>
            <input
              type="number" id="book-total-quantity" name="totalQuantity" min="0" required
              ref={totalRef} value={form.totalQuantity} onChange={set('totalQuantity')}
            />
            <p className="modal__hint">All copies recorded for this title, including copies already given to students.</p>
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--accent" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
