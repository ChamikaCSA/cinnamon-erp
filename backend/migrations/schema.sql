-- Drop tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS report_columns;
DROP TABLE IF EXISTS report_filters;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS transactions_entries;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS loan_schedule;
DROP TABLE IF EXISTS loan_payments;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS asset_attachments;
DROP TABLE IF EXISTS asset_maintenance;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS asset_categories;
DROP TABLE IF EXISTS purchase_items;
DROP TABLE IF EXISTS purchase_invoices;
DROP TABLE IF EXISTS sales_items;
DROP TABLE IF EXISTS sales_invoices;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS manufacturing_orders;
DROP TABLE IF EXISTS cinnamon_assignments;
DROP TABLE IF EXISTS land_assignments;
DROP TABLE IF EXISTS cutting_contractors;
DROP TABLE IF EXISTS manufacturing_contractors;
DROP TABLE IF EXISTS wells;
DROP TABLE IF EXISTS leases;
DROP TABLE IF EXISTS lands;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS salary_structures;
DROP TABLE IF EXISTS designations;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS currencies;

-- Currencies table 
CREATE TABLE currencies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(5) NOT NULL,
  rate DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'accountant', 'manager') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Settings table 
CREATE TABLE settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(255) NOT NULL,
  company_address TEXT NOT NULL,
  company_phone VARCHAR(50) NOT NULL,
  vat_number VARCHAR(50),
  tax_number VARCHAR(50),
  logo_url VARCHAR(255),
  language ENUM('en', 'si') DEFAULT 'en',
  default_currency VARCHAR(3) DEFAULT 'USD',
  email_notifications BOOLEAN DEFAULT true,
  low_stock_alerts BOOLEAN DEFAULT true,
  payment_reminders BOOLEAN DEFAULT true,
  task_deadlines BOOLEAN DEFAULT true,
  maintenance_alerts BOOLEAN DEFAULT true,
  loan_due_alerts BOOLEAN DEFAULT true,
  auto_backup BOOLEAN DEFAULT true,
  backup_frequency VARCHAR(20) DEFAULT 'daily',
  retention_period INT DEFAULT 30,
  backup_location VARCHAR(50) DEFAULT 'cloud',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (default_currency) REFERENCES currencies(code)
);

-- Designations table
CREATE TABLE designations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  department VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Salary Structures table
CREATE TABLE salary_structures (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  basic_salary DECIMAL(10,2) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  nic VARCHAR(20) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  birthday DATE NOT NULL,
  designation_id INT NOT NULL,
  employment_type ENUM('permanent', 'temporary') NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  salary_structure_id INT NOT NULL,
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  account_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (designation_id) REFERENCES designations(id),
  FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id)
);

-- Lands table
CREATE TABLE lands (
  id INT PRIMARY KEY AUTO_INCREMENT,
  parcel_number VARCHAR(50) NOT NULL UNIQUE,
  location VARCHAR(255) NOT NULL,
  area DECIMAL(10,2) NOT NULL,
  area_unit ENUM('hectares', 'acres', 'square_meters') NOT NULL,
  acquisition_date DATE NOT NULL,
  status ENUM('active', 'inactive', 'under_maintenance') DEFAULT 'active',
  forest_type VARCHAR(100) NOT NULL,
  soil_type VARCHAR(100),
  last_harvest_date DATE,
  next_harvest_date DATE,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Leases table (add after lands table)
CREATE TABLE leases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  lessor VARCHAR(255) NOT NULL,
  lessee VARCHAR(255) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  acreage DECIMAL(10,2) NOT NULL,
  royalty_rate DECIMAL(5,2) NOT NULL,
  status ENUM('active', 'expired', 'pending') NOT NULL DEFAULT 'active',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Wells table (add after leases table)
CREATE TABLE wells (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  lease_id INT NOT NULL,
  status ENUM('producing', 'shut-in', 'abandoned') NOT NULL DEFAULT 'producing',
  location_latitude DECIMAL(10,8),
  location_longitude DECIMAL(11,8),
  depth DECIMAL(10,2),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lease_id) REFERENCES leases(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Cutting Contractors table
CREATE TABLE cutting_contractors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  contractor_id VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturing Contractors table
CREATE TABLE manufacturing_contractors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  contractor_id VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Land Assignments table
CREATE TABLE land_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contractor_id INT NOT NULL,
  land_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contractor_id) REFERENCES cutting_contractors(id),
  FOREIGN KEY (land_id) REFERENCES lands(id)
);

-- Tasks table
CREATE TABLE tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('pending', 'in-progress', 'completed') DEFAULT 'pending',
  due_date DATE,
  assigned_to INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Asset Categories table
CREATE TABLE asset_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  depreciation_rate DECIMAL(5,2) NOT NULL DEFAULT 10,
  useful_life INT NOT NULL DEFAULT 5,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assets table
CREATE TABLE assets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  asset_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  type ENUM('equipment', 'vehicle', 'tool') NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_price DECIMAL(10,2) NOT NULL,
  current_value DECIMAL(10,2) NOT NULL,
  status ENUM('active', 'maintenance', 'retired') NOT NULL DEFAULT 'active',
  assigned_to INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES asset_categories(id),
  FOREIGN KEY (assigned_to) REFERENCES wells(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Product Categories table
CREATE TABLE product_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  description TEXT,
  unit_price DECIMAL(15,2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  minimum_quantity INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES product_categories(id)
);

-- Inventory table
CREATE TABLE inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  min_stock_level DECIMAL(10,2) NOT NULL,
  max_stock_level DECIMAL(10,2) NOT NULL,
  location VARCHAR(255) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  description TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_product (product_name)
);

-- Inventory Transactions table
CREATE TABLE inventory_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  type ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory(id)
);

-- Customers table
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Sales Invoices table
CREATE TABLE sales_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(20) UNIQUE NOT NULL,
  date DATE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_address TEXT,
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  sub_total DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'card', 'bank-transfer', 'other') NOT NULL,
  payment_status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  status ENUM('draft', 'confirmed', 'cancelled') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Sales Items table
CREATE TABLE sales_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  sub_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id),
  FOREIGN KEY (product_id) REFERENCES inventory(id)
);

-- Purchase Invoices table
CREATE TABLE purchase_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  status ENUM('draft', 'confirmed', 'paid', 'cancelled') DEFAULT 'draft',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Purchase Items table
CREATE TABLE purchase_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Loans table
CREATE TABLE loans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  loan_number VARCHAR(20) UNIQUE NOT NULL,
  borrower_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  term_months INT NOT NULL,
  remaining_balance DECIMAL(15,2) NOT NULL,
  status ENUM('pending', 'active', 'completed', 'overdue', 'cancelled') DEFAULT 'pending',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (borrower_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Loan Payments table
CREATE TABLE loan_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  loan_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  reference VARCHAR(20) UNIQUE,
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'completed',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Loan Schedule table
CREATE TABLE loan_schedule (
  id INT PRIMARY KEY AUTO_INCREMENT,
  loan_id INT NOT NULL,
  period_number INT NOT NULL,
  due_date DATE NOT NULL,
  payment_amount DECIMAL(15,2) NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  status ENUM('pending', 'paid', 'overdue') DEFAULT 'pending',
  paid_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

-- Manufacturing Orders table
CREATE TABLE manufacturing_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status ENUM('planned', 'in_progress', 'completed', 'cancelled') DEFAULT 'planned',
  notes TEXT,
  assigned_to INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Asset Maintenance table
CREATE TABLE asset_maintenance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_id INT NOT NULL,
  maintenance_date DATE NOT NULL,
  type ENUM('routine', 'repair', 'upgrade') NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  next_maintenance_date DATE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Cinnamon Assignments table
CREATE TABLE cinnamon_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contractor_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contractor_id) REFERENCES manufacturing_contractors(id)
);

-- Asset Attachments table
CREATE TABLE asset_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  maintenance_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (maintenance_id) REFERENCES asset_maintenance(id)
);

-- Accounts table
CREATE TABLE accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  category ENUM('current', 'fixed', 'current-liability', 'long-term-liability', 'capital', 'operational') NOT NULL,
  description TEXT,
  balance DECIMAL(15,2) DEFAULT 0,
  is_system_account BOOLEAN DEFAULT FALSE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reference VARCHAR(50) UNIQUE NOT NULL,
  date DATE NOT NULL,
  type ENUM('revenue', 'expense') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category ENUM('production', 'maintenance', 'royalty', 'lease') NOT NULL,
  description TEXT NOT NULL,
  well_id INT NOT NULL,
  lease_id INT NOT NULL,
  created_by INT NOT NULL,
  status ENUM('draft', 'posted', 'void') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (well_id) REFERENCES wells(id),
  FOREIGN KEY (lease_id) REFERENCES leases(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Transactions Entries table
CREATE TABLE transactions_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL,
  account_id INT NOT NULL,
  description TEXT,
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Indexes
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_category ON accounts(category);

-- Reports table
CREATE TABLE reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_si VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description_en TEXT,
  description_si TEXT,
  query TEXT NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Report Filters table
CREATE TABLE report_filters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  field VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  label_en VARCHAR(100) NOT NULL,
  label_si VARCHAR(100) NOT NULL,
  options JSON,
  default_value VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

-- Report Columns table
CREATE TABLE report_columns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  field VARCHAR(50) NOT NULL,
  header_en VARCHAR(100) NOT NULL,
  header_si VARCHAR(100) NOT NULL,
  width INT,
  sortable BOOLEAN DEFAULT true,
  format VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
); 