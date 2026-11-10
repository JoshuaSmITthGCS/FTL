import { Link, NavLink } from 'react-router-dom';

function Nav() {
  const cls = ({ isActive }) => (isActive ? 'active' : undefined);
  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <div className="container site-nav__inner">
        <Link to="/" className="site-nav__brand">Free Textbook Library</Link>
        <ul className="site-nav__links">
          <li><NavLink to="/" end className={cls}>Home</NavLink></li>
          <li><NavLink to="/catalog" className={cls}>Browse Catalog</NavLink></li>
          <li><Link to="/#about">About</Link></li>
          <li><NavLink to="/admin" className={cls}>Admin</NavLink></li>
        </ul>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div>
            <div className="site-footer__brand">Free Textbook Library</div>
            <p className="site-footer__tagline">A volunteer-run free textbook library for College of Charleston students. Free access, no fees, no questions.</p>
          </div>
          <div className="site-footer__col">
            <h4>Navigate</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/catalog">Catalog</Link></li>
              <li><Link to="/admin">Admin</Link></li>
            </ul>
          </div>
          <div className="site-footer__col">
            <h4>Get involved</h4>
            <ul>
              <li><a href="mailto:freetextbooklibrary@cofc.edu?subject=Book%20Donation">Donate books</a></li>
              <li><a href="mailto:freetextbooklibrary@cofc.edu?subject=Volunteer">Volunteer</a></li>
              <li><a href="mailto:freetextbooklibrary@cofc.edu">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="site-footer__legal">
          <span>© 2026 Free Textbook Library at the College of Charleston. A student-run initiative.</span>
          <span>Center for Sustainable Development, 207 Calhoun St. College of Charleston · Mon–Thurs · 9am–5pm</span>
        </div>
      </div>
    </footer>
  );
}

export default function Layout({ children }) {
  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
