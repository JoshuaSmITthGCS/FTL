import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { groupBySubject } from '../lib/inventory.js';
import { useInventory } from '../lib/useInventory.js';

export default function HomePage() {
  const { books, loading } = useInventory();
  const subjectMap = useMemo(() => groupBySubject(books), [books]);
  const availableCount = books.filter((b) => b.status === 'Available').length;
  const subjects = Object.entries(subjectMap).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <section className="hero">
        <div className="hero__ribbon"></div>
        <div className="container">
          <div className="eyebrow">Free · For Students · By Students</div>
          <div className="hero__grid">
            <h1 className="hero__headline">A library for <em>every</em> student who needs a textbook.</h1>
            <div>
              <p className="hero__lead">Take it, keep it, or pass it on — no fees, no fines, no questions. Browse the shelf, request a book, pick it up on campus.</p>
              <div className="hero__ctas">
                <Link className="btn btn--primary" to="/catalog">Browse the catalog</Link>
                <a className="btn btn--ghost" href="#how">How it works</a>
              </div>
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat__number">{loading ? '—' : availableCount}</div>
              <div className="stat__label">Books on the shelf</div>
            </div>
            <div className="stat">
              <div className="stat__number">{loading ? '—' : subjects.length}</div>
              <div className="stat__label">Subjects covered</div>
            </div>
            <div className="stat">
              <div className="stat__number">$0</div>
              <div className="stat__label">Cost to students</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="how">
        <div className="container">
          <div className="how__header">
            <h2 className="how__title">How the library works</h2>
            <p className="how__intro">No library card, no waitlist, no late fees. The whole point is friction-free access to the textbooks you need for the semester.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step__number"></div>
              <h3 className="step__title">Search the catalog</h3>
              <p className="step__desc">Filter by subject, title, author, or ISBN. If we have it, you'll see it listed as available.</p>
            </div>
            <div className="step">
              <div className="step__number"></div>
              <h3 className="step__title">Request a book</h3>
              <p className="step__desc">Tap request, tell us who you are and how to reach you. A volunteer will email you within 48-72 hours.</p>
            </div>
            <div className="step">
              <div className="step__number"></div>
              <h3 className="step__title">Pick it up</h3>
              <p className="step__desc">Once you have been emailed with confirmation from a volunteer, drop by the library during open hours to pick up your book.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="about-section">
        <div className="container about-section__inner">
          <h2 className="about-section__title">About the library</h2>
          <div className="about-section__body">
            <p>The Free Textbook Library started as a simple idea — students shouldn't have to choose between eating and buying a $300 biology textbook. We take donated books from graduating students, faculty, and community members, log them, and put them back into circulation.</p>
            <p>Everything is volunteer-run. Every book is free. We don't track who has what or when it comes back. The only rule: when you're done, pass it on — either back to us or to another student who needs it.</p>
            <p>If you have books to donate or want to volunteer with inventory, maintenance, or outreach, reach out through the Get Involved section below.</p>
          </div>
        </div>
      </section>

      <section className="subjects-strip">
        <div className="container">
          <h2>Browse by subject</h2>
          <div className="subjects-grid">
            {loading ? (
              <div className="empty-state">Loading subjects…</div>
            ) : subjects.length ? (
              subjects.map(([subject, list]) => (
                <Link key={subject} className="subject-card" to={`/catalog?subject=${encodeURIComponent(subject)}`}>
                  <div className="subject-card__name">{subject}</div>
                  <div className="subject-card__count">
                    {list.filter((b) => b.status === 'Available').length} available · {list.length} total
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">No books yet.</div>
            )}
          </div>

          <div className="cta-banner">
            <div>
              <h2>Need a textbook?</h2>
              <p>The catalog is updated weekly by volunteers. Most requests are fulfilled within 48-72 hours.</p>
            </div>
            <Link to="/catalog" className="btn btn--accent">Browse catalog →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
