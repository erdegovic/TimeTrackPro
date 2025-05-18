import { db } from '../server/db';
import * as schema from '../shared/schema';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';

// This script initializes the database by pushing the schema
async function main() {
  console.log('Initializing database...');
  
  try {
    // Create tables
    console.log('Creating clients table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        country TEXT,
        phone TEXT,
        tax_id TEXT
      );
    `);
    
    console.log('Creating invoices table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        subtotal NUMERIC(10, 2) NOT NULL,
        tax NUMERIC(10, 2) DEFAULT '0',
        tax_rate NUMERIC(5, 2) DEFAULT '0',
        total NUMERIC(10, 2) NOT NULL,
        notes TEXT
      );
    `);
    
    console.log('Creating projects table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        description TEXT,
        active BOOLEAN DEFAULT true,
        hourly_rate NUMERIC(10, 2) DEFAULT '0'
      );
    `);
    
    console.log('Creating time_entries table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration NUMERIC(10, 2),
        date TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        week_label TEXT NOT NULL,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        billable BOOLEAN DEFAULT true,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL
      );
    `);
    
    console.log('Creating settings table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        business_name TEXT,
        business_address TEXT,
        business_city TEXT,
        business_state TEXT,
        business_zip_code TEXT,
        business_country TEXT,
        business_phone TEXT,
        business_email TEXT,
        business_tax_id TEXT,
        bank_name TEXT,
        bank_account_name TEXT,
        bank_account_number TEXT,
        next_invoice_number INTEGER DEFAULT 1001,
        default_time_format TEXT DEFAULT 'decimal',
        default_currency TEXT DEFAULT 'USD'
      );
    `);
    
    // Insert default settings
    console.log('Inserting default settings...');
    await db.execute(`
      INSERT INTO settings (
        business_name, business_address, business_city, business_state, 
        business_zip_code, business_country, business_phone, business_email,
        business_tax_id, bank_name, bank_account_name, bank_account_number,
        next_invoice_number, default_time_format, default_currency
      ) 
      VALUES (
        'Your Business Name', '123 Your Street', 'Your City', 'ST',
        '12345', 'USA', '+1 (123) 456-7890', 'your.email@example.com',
        '12-3456789', 'First National Bank', 'Your Business Name', 'XXXX-XXXX-1234',
        1001, 'decimal', 'USD'
      )
      ON CONFLICT (id) DO NOTHING;
    `);
    
    // Insert sample clients
    console.log('Inserting sample clients...');
    await db.execute(`
      INSERT INTO clients (name, email, address, city, state, zip_code, country, phone, tax_id)
      VALUES 
        ('Acme Inc.', 'accounting@acmeinc.com', '456 Client Avenue', 'Client City', 'ST', '54321', 'USA', '+1 (987) 654-3210', '98-7654321'),
        ('TechFirm LLC', 'billing@techfirm.com', '789 Tech Blvd', 'Tech City', 'ST', '67890', 'USA', '+1 (123) 987-6543', '45-6789012'),
        ('Design Studios', 'accounts@designstudios.com', '321 Design Street', 'Design City', 'ST', '12345', 'USA', '+1 (456) 789-0123', '78-9012345')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    // Insert sample projects
    console.log('Inserting sample projects...');
    await db.execute(`
      INSERT INTO projects (name, client_id, description, active, hourly_rate)
      VALUES 
        ('Website Redesign', 1, 'Complete website redesign for Acme Inc.', true, '100'),
        ('API Integration', 2, 'Integration with third-party APIs for TechFirm LLC', true, '120'),
        ('Content Creation', 3, 'Blog posts and content writing for Design Studios', true, '90')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });