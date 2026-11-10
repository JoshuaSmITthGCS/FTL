import { useEffect, useState } from 'react';
import { fetchInventory } from './inventory.js';

// One-shot load of the public catalog (Firestore, falling back to the seed file).
export function useInventory() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchInventory().then((result) => {
      if (cancelled) return;
      setBooks(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { books, setBooks, loading };
}
