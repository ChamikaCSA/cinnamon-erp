const BaseModel = require('../base/BaseModel');

class Land extends BaseModel {
  constructor() {
    super('lands');
  }

  async findByLandNumber(landNumber) {
    const [rows] = await this.pool.execute(
      'SELECT * FROM lands WHERE land_number = ?',
      [landNumber]
    );
    return rows[0];
  }

  async getActiveWithAssignments() {
    const [rows] = await this.pool.execute(`
      SELECT l.*, la.contractor_id, la.start_date, la.end_date, la.status as assignment_status
      FROM lands l
      LEFT JOIN land_assignments la ON l.id = la.land_id AND la.status = 'active'
      WHERE l.status = 'active'
      ORDER BY l.created_at DESC
    `);
    return rows;
  }
}

module.exports = new Land();