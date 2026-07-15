#!/usr/bin/env node
/**
 * setup-firebase.js
 *
 * Automated Firebase setup script - sets up everything via CLI
 *
 * Prerequisites:
 *   1. Firebase CLI installed: npm install -g firebase-tools
 *   2. Logged in: firebase login
 *   3. Firebase project created (we'll ask for project ID)
 *   4. Service account JSON downloaded and saved as service-account.json
 *
 * This script:
 *   - Enables Firestore and Authentication
 *   - Creates admin user (email: admin@freetextbooklibrary.local, password: admin)
 *   - Migrates all books from seed-inventory.json to Firestore
 *   - Creates admin document with permissions
 *   - Deploys Firestore security rules
 */

import { readFile, writeFile } from 'fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { execSync } from 'child_process';
import * as readline from 'readline';

const ADMIN_EMAIL = 'admin@freetextbooklibrary.local';
const ADMIN_PASSWORD = 'admin123';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

function execCommand(command, description) {
  console.log(`\n→ ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(`✓ ${description} - Done`);
    return output;
  } catch (error) {
    console.error(`✗ ${description} - Failed`);
    console.error(error.message);
    throw error;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Firebase Automated Setup');
  console.log('  Free Textbook Library');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Step 1: Get Firebase project ID
  console.log('📋 Step 1: Firebase Project Configuration\n');
  const projectId = await question('Enter your Firebase project ID: ');

  if (!projectId || projectId.trim() === '') {
    console.error('❌ Project ID is required');
    rl.close();
    process.exit(1);
  }

  console.log(`\n✓ Using project: ${projectId}`);

  // Step 2: Update .firebaserc
  console.log('\n📋 Step 2: Updating .firebaserc\n');
  try {
    const firebaserc = {
      projects: {
        default: projectId
      }
    };
    await writeFile('./.firebaserc', JSON.stringify(firebaserc, null, 2));
    console.log('✓ Updated .firebaserc');
  } catch (error) {
    console.error('❌ Failed to update .firebaserc:', error.message);
    rl.close();
    process.exit(1);
  }

  // Step 3: Check if logged in to Firebase CLI
  console.log('\n📋 Step 3: Verifying Firebase CLI login\n');
  try {
    execCommand('firebase login:list', 'Checking Firebase login');
  } catch (error) {
    console.log('\n⚠️  Not logged in to Firebase CLI');
    console.log('Run: firebase login');
    rl.close();
    process.exit(1);
  }

  // Step 4: Use the Firebase project
  console.log('\n📋 Step 4: Setting active Firebase project\n');
  execCommand(`firebase use ${projectId}`, 'Setting active project');

  // Step 5: Deploy Firestore rules
  console.log('\n📋 Step 5: Deploying Firestore security rules\n');
  execCommand('firebase deploy --only firestore:rules', 'Deploying Firestore rules');

  // Step 6: Initialize Firebase Admin SDK
  console.log('\n📋 Step 6: Initializing Firebase Admin SDK\n');
  let app, auth, db;
  try {
    const serviceAccount = JSON.parse(
      await readFile('./service-account.json', 'utf8')
    );

    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId
    });

    auth = getAuth(app);
    db = getFirestore(app);

    console.log('✓ Firebase Admin SDK initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    console.error('   Make sure service-account.json exists in project root');
    console.error('   Download from: Firebase Console → Project Settings → Service Accounts');
    console.error('   Error:', error.message);
    rl.close();
    process.exit(1);
  }

  // Step 7: Create admin user
  console.log('\n📋 Step 7: Creating admin user\n');
  let adminUser;
  try {
    // Try to get existing user
    try {
      adminUser = await auth.getUserByEmail(ADMIN_EMAIL);
      console.log(`✓ Admin user already exists: ${ADMIN_EMAIL}`);
      console.log(`  UID: ${adminUser.uid}`);
    } catch (error) {
      // User doesn't exist, create it
      adminUser = await auth.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        emailVerified: true
      });
      console.log(`✓ Created admin user: ${ADMIN_EMAIL}`);
      console.log(`  Password: ${ADMIN_PASSWORD}`);
      console.log(`  UID: ${adminUser.uid}`);
    }
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    rl.close();
    process.exit(1);
  }

  // Step 8: Create admin document in Firestore
  console.log('\n📋 Step 8: Setting admin permissions\n');
  try {
    const adminDoc = db.collection('admins').doc(adminUser.uid);
    await adminDoc.set({
      isAdmin: true,
      email: ADMIN_EMAIL,
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`✓ Created admin document in /admins/${adminUser.uid}`);
  } catch (error) {
    console.error('❌ Failed to create admin document:', error.message);
    rl.close();
    process.exit(1);
  }

  // Step 9: Migrate books
  console.log('\n📋 Step 9: Migrating books to Firestore\n');
  let books;
  try {
    const data = await readFile('./data/seed-inventory.json', 'utf8');
    books = JSON.parse(data);
    console.log(`✓ Loaded ${books.length} books from seed-inventory.json`);
  } catch (error) {
    console.error('❌ Failed to load seed-inventory.json:', error.message);
    rl.close();
    process.exit(1);
  }

  try {
    const batch = db.batch();
    const timestamp = FieldValue.serverTimestamp();

    let validBooks = 0;
    for (const book of books) {
      if (!book.title || !book.id) {
        console.warn(`⚠️  Skipping book with missing title or id`);
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
    }

    // Create stats document
    const statsRef = db.collection('metadata').doc('stats');
    batch.set(statsRef, {
      totalBooks: validBooks,
      availableBooks: books.filter(b => b.status === 'Available').length,
      lastUpdated: timestamp
    });

    await batch.commit();
    console.log(`✓ Migrated ${validBooks} books to Firestore`);
    console.log(`✓ Created stats document in /metadata/stats`);
  } catch (error) {
    console.error('❌ Failed to migrate books:', error.message);
    rl.close();
    process.exit(1);
  }

  // Step 10: Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ Setup Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Admin Email: ${ADMIN_EMAIL}`);
  console.log(`   Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`   Books Migrated: ${books.length}`);
  console.log('');
  console.log('🔑 Next Steps:');
  console.log('');
  console.log('1. Get your Firebase web app config:');
  console.log('   → Go to: https://console.firebase.google.com/');
  console.log('   → Project Settings → Your apps → Web app');
  console.log('   → Copy the firebaseConfig object');
  console.log('');
  console.log('2. Update js/firebase-config.js with your config');
  console.log('');
  console.log('3. Test locally:');
  console.log('   $ python3 -m http.server 8000');
  console.log('   → Open http://localhost:8000/admin.html');
  console.log('   → Login with password: admin');
  console.log('');
  console.log('4. Deploy to Firebase Hosting:');
  console.log('   $ firebase deploy');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  rl.close();
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  rl.close();
  process.exit(1);
});
