#!/usr/bin/env node
/**
 * migrate-to-firebase.js
 *
 * One-time migration script to move seed inventory data to Firestore.
 *
 * Usage:
 *   npm run migrate:dry    # Test run without writing
 *   npm run migrate        # Execute migration
 *
 * Prerequisites:
 *   1. Download service account JSON from Firebase Console
 *   2. Save as service-account.json in project root
 *   3. Run: npm install
 */

import { readFile } from 'fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Firebase Migration: Free Textbook Library');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }

  // Initialize Firebase Admin
  try {
    const serviceAccount = JSON.parse(
      await readFile('./service-account.json', 'utf8')
    );

    initializeApp({
      credential: cert(serviceAccount)
    });

    console.log('✓ Firebase Admin SDK initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    console.error('   Make sure service-account.json exists in project root');
    console.error('   Error:', error.message);
    process.exit(1);
  }

  const db = getFirestore();

  // Load seed inventory
  let books;
  try {
    const data = await readFile('./data/seed-inventory.json', 'utf8');
    books = JSON.parse(data);
    console.log(`✓ Loaded ${books.length} books from seed-inventory.json\n`);
  } catch (error) {
    console.error('❌ Failed to load seed-inventory.json');
    console.error('   Error:', error.message);
    process.exit(1);
  }

  if (!books || !Array.isArray(books) || books.length === 0) {
    console.error('❌ No books found in seed-inventory.json');
    process.exit(1);
  }

  // Prepare batch write
  console.log('Preparing migration...\n');

  const batch = db.batch();
  const timestamp = FieldValue.serverTimestamp();

  let validBooks = 0;
  let skippedBooks = 0;

  for (const book of books) {
    // Validate required fields
    if (!book.title || !book.id) {
      console.warn(`⚠️  Skipping book with missing title or id:`, book);
      skippedBooks++;
      continue;
    }

    const docRef = db.collection('books').doc(book.id.toString());
    const bookData = {
      id: book.id,
      title: book.title,
      isbn: book.isbn || '',
      subject: book.subject || 'Uncategorized',
      status: book.status || 'Available',
      quantity: book.quantity || 1,
      author: book.author || '',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    batch.set(docRef, bookData);
    validBooks++;

    if (validBooks <= 5 || validBooks % 50 === 0) {
      console.log(`  ${validBooks}. ${book.title}`);
    }
  }

  console.log('');
  console.log(`📊 Migration summary:`);
  console.log(`   Valid books: ${validBooks}`);
  console.log(`   Skipped: ${skippedBooks}`);
  console.log('');

  // Create stats document
  const statsRef = db.collection('metadata').doc('stats');
  batch.set(statsRef, {
    totalBooks: validBooks,
    availableBooks: books.filter(b => b.status === 'Available').length,
    lastUpdated: timestamp
  });

  // Execute migration
  if (DRY_RUN) {
    console.log('✓ Dry run completed successfully');
    console.log('  Run "npm run migrate" to execute the migration\n');
  } else {
    try {
      await batch.commit();
      console.log('✅ Migration completed successfully!');
      console.log(`   ${validBooks} books written to Firestore /books collection`);
      console.log(`   Stats written to /metadata/stats\n`);
    } catch (error) {
      console.error('❌ Migration failed during write');
      console.error('   Error:', error.message);
      process.exit(1);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
