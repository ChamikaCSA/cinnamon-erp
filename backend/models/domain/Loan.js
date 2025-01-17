const BaseModel = require('../base/BaseModel');
const { pool } = require('../../config/db');

class Loan extends BaseModel {
  constructor() {
    super('loans');
    this.pool = pool;
  }

  async generateLoanNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM loans WHERE YEAR(created_at) = YEAR(CURRENT_DATE)'
    );
    const count = result[0].count + 1;
    return `LN${year}${count.toString().padStart(4, '0')}`;
  }

  async getWithDetails(id) {
    const [loan] = await pool.execute(`
      SELECT l.*,
             u.name as created_by_name
      FROM loans l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.id = ?
    `, [id]);

    if (!loan[0]) return null;

    const [payments] = await pool.execute(`
      SELECT lp.*,
             u.name as created_by_name
      FROM loan_payments lp
      LEFT JOIN users u ON lp.created_by = u.id
      WHERE lp.loan_id = ?
      ORDER BY lp.payment_date DESC
    `, [id]);

    const [schedule] = await pool.execute(`
      SELECT * FROM loan_schedule
      WHERE loan_id = ?
      ORDER BY due_date ASC
    `, [id]);

    return {
      ...loan[0],
      payments,
      schedule
    };
  }

  async createWithSchedule(loanData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Generate loan number first
      const loanNumber = await this.generateLoanNumber();

      // Ensure all required fields have values or null
      const loan = {
        borrower_type: loanData.borrower_type,
        borrower_id: loanData.borrower_id,
        amount: Number(loanData.amount),
        interest_rate: Number(loanData.interest_rate),
        term_months: Number(loanData.term_months),
        payment_frequency: loanData.payment_frequency,
        start_date: loanData.start_date,
        end_date: loanData.end_date,
        purpose: loanData.purpose || null,
        collateral: loanData.collateral || null,
        status: loanData.status || 'active',
        notes: loanData.notes || null,
        remaining_balance: Number(loanData.amount),
        loan_number: loanNumber,
        created_by: loanData.created_by
      };

      // Insert loan record
      const [result] = await connection.execute(
        `INSERT INTO loans (
          borrower_type, borrower_id, amount, interest_rate,
          term_months, payment_frequency, start_date, end_date,
          purpose, collateral, status, notes, remaining_balance,
          loan_number, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          loan.borrower_type,
          loan.borrower_id,
          loan.amount,
          loan.interest_rate,
          loan.term_months,
          loan.payment_frequency,
          loan.start_date,
          loan.end_date,
          loan.purpose,
          loan.collateral,
          loan.status,
          loan.notes,
          loan.remaining_balance,
          loan.loan_number,
          loan.created_by
        ]
      );
      const loanId = result.insertId;

      // Calculate payment schedule
      const schedule = this.calculatePaymentSchedule(loan);

      // Create schedule records
      for (const item of schedule) {
        const scheduleItem = {
          ...item,
          loan_id: loanId,
          created_by: loan.created_by
        };
        const scheduleColumns = Object.keys(item).join(', ');
        const schedulePlaceholders = Object.keys(item).map(() => '?').join(', ');
        const scheduleValues = Object.values(scheduleItem);

        await connection.execute(
          `INSERT INTO loan_schedule (${scheduleColumns}) VALUES (${schedulePlaceholders})`,
          scheduleValues
        );
      }

      await connection.commit();
      connection.release();
      return this.getWithDetails(loanId);
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  }

  calculatePaymentSchedule(loan) {
    const {
      amount,
      interest_rate,
      term,
      payment_frequency,
      start_date
    } = loan;

    const periodsPerYear = {
      weekly: 52,
      monthly: 12,
      quarterly: 4,
      annually: 1
    }[payment_frequency];

    const totalPeriods = term * periodsPerYear;
    const periodicRate = interest_rate / 100 / periodsPerYear;
    const paymentAmount = (amount * periodicRate * Math.pow(1 + periodicRate, totalPeriods)) /
                         (Math.pow(1 + periodicRate, totalPeriods) - 1);

    const schedule = [];
    let remainingBalance = amount;
    let dueDate = new Date(start_date);

    for (let i = 1; i <= totalPeriods; i++) {
      const interest = remainingBalance * periodicRate;
      const principal = paymentAmount - interest;
      remainingBalance -= principal;

      schedule.push({
        period_number: i,
        due_date: dueDate,
        payment_amount: paymentAmount,
        principal_amount: principal,
        interest_amount: interest,
        balance: Math.max(0, remainingBalance),
        status: 'pending'
      });

      // Calculate next due date based on frequency
      switch (payment_frequency) {
        case 'weekly':
          dueDate = new Date(dueDate.setDate(dueDate.getDate() + 7));
          break;
        case 'monthly':
          dueDate = new Date(dueDate.setMonth(dueDate.getMonth() + 1));
          break;
        case 'quarterly':
          dueDate = new Date(dueDate.setMonth(dueDate.getMonth() + 3));
          break;
        case 'annually':
          dueDate = new Date(dueDate.setFullYear(dueDate.getFullYear() + 1));
          break;
      }
    }

    return schedule;
  }
}

module.exports = Loan;