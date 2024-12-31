const BaseModel = require('../base/BaseModel');

class Dashboard extends BaseModel {
  constructor() {
    super('dashboard');
  }

  async getLandsCount() {
    const [rows] = await this.pool.execute(`
      SELECT COUNT(*) as count
      FROM lands
      WHERE status = 'active'
    `);
    return rows[0].count;
  }

  async getActiveEmployeesCount() {
    const [rows] = await this.pool.execute(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE status = 'active'
    `);
    return rows[0].count;
  }

  async getPendingTasksCount() {
    const [rows] = await this.pool.execute(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE status = 'pending'
    `);
    return rows[0].count;
  }

  async getMonthlyRevenue() {
    const [rows] = await this.pool.execute(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE status = 'posted'
        AND type = 'revenue'
        AND MONTH(date) = MONTH(CURRENT_DATE())
        AND YEAR(date) = YEAR(CURRENT_DATE())
    `);
    return rows[0].total;
  }

  async getRevenueData() {
    const [rows] = await this.pool.execute(`
      SELECT
        DATE_FORMAT(MIN(date), '%b') as month,
        COALESCE(SUM(amount), 0) as revenue,
        MIN(date) as full_date
      FROM transactions
      WHERE status = 'posted'
        AND type = 'revenue'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      GROUP BY YEAR(date), MONTH(date)
      ORDER BY full_date DESC
      LIMIT 6
    `);
    return rows;
  }

  async getMonthlyTarget() {
    const [rows] = await this.pool.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0) as achieved,
        COALESCE(
          (SELECT mt.target_amount * (c.rate / dc.rate)
           FROM monthly_targets mt
           CROSS JOIN settings s
           JOIN currencies c ON s.default_currency = c.id
           JOIN currencies dc ON dc.id = 1  -- Base currency (LKR)
           WHERE MONTH(mt.period) = MONTH(CURRENT_DATE())
           AND YEAR(mt.period) = YEAR(CURRENT_DATE())
          ), 30000
        ) as target
      FROM transactions
      WHERE status = 'posted'
        AND MONTH(date) = MONTH(CURRENT_DATE())
        AND YEAR(date) = YEAR(CURRENT_DATE())
    `);

    // If no data exists, return default values adjusted by current currency rate
    if (!rows || !rows[0]) {
      const [currencyRate] = await this.pool.execute(`
        SELECT c.rate / dc.rate as conversion_rate
        FROM settings s
        JOIN currencies c ON s.default_currency = c.id
        JOIN currencies dc ON dc.id = 1  -- Base currency (LKR)
        LIMIT 1
      `);

      const rate = currencyRate[0]?.conversion_rate || 1;
      return {
        achieved: 0,
        target: 30000 * rate
      };
    }

    return {
      achieved: Number(rows[0].achieved) || 0,
      target: Number(rows[0].target) || 30000
    };
  }

  async getTaskCompletionRate() {
    const [rows] = await this.pool.execute(`
      SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completion_rate
      FROM tasks
      WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `);
    return Math.round(rows[0].completion_rate || 0);
  }

  async updateMonthlyTarget(period, targetAmount, userId) {
    // Convert target amount to base currency (LKR) before storing
    const [currencyRate] = await this.pool.execute(`
      SELECT dc.rate / c.rate as conversion_rate
      FROM settings s
      JOIN currencies c ON s.default_currency = c.id
      JOIN currencies dc ON dc.id = 1  -- Base currency (LKR)
      LIMIT 1
    `);

    const rate = currencyRate[0]?.conversion_rate || 1;
    const baseAmount = targetAmount * rate;

    const [existing] = await this.pool.execute(
      'SELECT id FROM monthly_targets WHERE period = ?',
      [period]
    );

    if (existing.length > 0) {
      await this.pool.execute(
        `UPDATE monthly_targets
         SET target_amount = ?,
             updated_at = CURRENT_TIMESTAMP,
             created_by = ?
         WHERE period = ?`,
        [baseAmount, userId, period]
      );
    } else {
      await this.pool.execute(
        `INSERT INTO monthly_targets (period, target_amount, created_by)
         VALUES (?, ?, ?)`,
        [period, baseAmount, userId]
      );
    }
  }
}

module.exports = new Dashboard();
