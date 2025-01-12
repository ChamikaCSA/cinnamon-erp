const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Report = require('../models/domain/Report');
const Transaction = require('../models/domain/Transaction');
const Account = require('../models/domain/Account');
const Settings = require('../models/domain/Settings');
const { authorize } = require('../middleware/authMiddleware');
const reportTemplates = require('../data/reportTemplates');
const { pool } = require('../config/db');

let ExcelJS, PDFDocument, moment;
try {
  ExcelJS = require('exceljs');
  PDFDocument = require('pdfkit');
  moment = require('moment');
} catch (error) {
  console.warn('Warning: Some report generation features may be unavailable');
}

// Add this helper function at the top of the file
async function executeQuery(query, params) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, params);
    return rows;
  } finally {
    connection.release();
  }
}

// Add this new route before the report routes
router.get('/departments', protect, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT d.department as department_name
      FROM employees e
      JOIN designations d ON e.designation_id = d.id
      WHERE d.department IS NOT NULL
      ORDER BY d.department
    `;

    const departments = await executeQuery(query);

    // Transform into the format expected by the frontend
    const formattedDepartments = departments.map(dept => ({
      value: dept.department_name,
      label: {
        en: dept.department_name.charAt(0).toUpperCase() + dept.department_name.slice(1),
        si: dept.department_name
      }
    }));

    res.json(formattedDepartments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add this new route before the report routes
router.get('/product-lines', protect, async (req, res) => {
  try {
    const query = `
      SELECT
        p.id as value,
        p.name as product_name
      FROM products p
      WHERE p.status = 'active'
      ORDER BY p.name
    `;

    const productLines = await executeQuery(query);

    // Transform into the format expected by the frontend
    const formattedProductLines = productLines.map(prod => ({
      value: prod.value,
      label: {
        en: prod.product_name,
        si: prod.product_name
      }
    }));

    res.json(formattedProductLines);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add this new route before the report routes
router.get('/material-categories', protect, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        category as value,
        category as category_name
      FROM inventory
      WHERE category IS NOT NULL
      ORDER BY category
    `;

    const categories = await executeQuery(query);

    // Transform into the format expected by the frontend
    const formattedCategories = categories.map(cat => ({
      value: cat.value,
      label: {
        en: cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1),
        si: cat.category_name
      }
    }));

    res.json(formattedCategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add route to get cutting contractors for report filters
router.get('/cutting-contractors', protect, async (req, res) => {
  try {
    const query = `
      SELECT
        id as value,
        name,
        contractor_id,
        status
      FROM cutting_contractors
      ORDER BY status = 'active' DESC, name
    `;

    const contractors = await executeQuery(query);

    // Transform into the format expected by the frontend
    const formattedContractors = contractors.map(contractor => ({
      value: contractor.value,
      label: {
        en: `${contractor.name} (${contractor.contractor_id})${contractor.status !== 'active' ? ' - ' + contractor.status.toUpperCase() : ''}`,
        si: `${contractor.name} (${contractor.contractor_id})${contractor.status !== 'active' ? ' - ' + contractor.status.toUpperCase() : ''}`
      }
    }));

    res.json(formattedContractors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get available reports
router.get('/templates', protect, authorize('admin', 'manager', 'accountant'), async (req, res) => {
  try {
    // Instead of querying the database, return the templates from reportTemplates.js
    const templates = reportTemplates.map(template => ({
      ...template,
      // Add any additional fields needed by the frontend
      status: 'active'
    }));

    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate report
router.post('/generate/:code', protect, async (req, res) => {
  try {
    const { code } = req.params;
    const { filters, format = 'json', language = 'en' } = req.body;

    // Get currency settings using direct query
    const [settingsRows] = await pool.execute('SELECT * FROM settings LIMIT 1');
    const settings = settingsRows[0];

    if (!settings || !settings.default_currency) {
      return res.status(500).json({ message: 'Currency settings not configured' });
    }
    const currency = {
      code: settings.default_currency,
      symbol: settings.currency_symbol || '$'  // Fallback to $ if not set
    };

    // Find the report template
    const template = reportTemplates.find(t => t.code === code);
    if (!template) {
      return res.status(404).json({ message: 'Report template not found' });
    }

    // Execute query based on report type
    let results;
    switch (code) {
      case 'SALES_SUMMARY': {
        // Make the date filter optional
        const dateFilter = filters.dateRange ? new Date(filters.dateRange) : null;
        const query = `
          SELECT
            DATE(t.date) as date,
            SUM(te.credit - te.debit) as totalSales,
            COUNT(DISTINCT t.id) as itemCount,
            COUNT(DISTINCT te.id) as transactionCount,
            AVG(te.credit - te.debit) as averageSale,
            MAX(te.credit - te.debit) as maxSale,
            MIN(te.credit - te.debit) as minSale
          FROM transactions t
          JOIN transactions_entries te ON t.id = te.transaction_id
          JOIN accounts a ON te.account_id = a.id
          WHERE a.type = 'revenue'
          ${dateFilter ? 'AND DATE(t.date) >= ?' : ''}
          GROUP BY DATE(t.date)
          ORDER BY date DESC
          LIMIT 10
        `;

        const params = [
          ...(dateFilter ? [dateFilter.toISOString().split('T')[0]] : [])
        ];

        console.log('Executing SALES_SUMMARY query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('SALES_SUMMARY results:', rows);

        results = rows.map(row => ({
          date: row.date,
          totalSales: Number(row.totalSales || 0),
          itemCount: Number(row.itemCount || 0),
          transactionCount: Number(row.transactionCount || 0),
          averageSale: Number(row.averageSale || 0),
          maxSale: Number(row.maxSale || 0),
          minSale: Number(row.minSale || 0)
        }));
        break;
      }

      case 'EMPLOYEE_SUMMARY': {
        const departmentFilter = filters.department ? `AND d.department = ?` : '';
        const employmentTypeFilter = filters.employmentType ? `AND e.employment_type = ?` : '';

        const query = `
          SELECT
            e.name,
            d.title as designation,
            d.department,
            e.employment_type,
            e.status
          FROM employees e
          JOIN designations d ON e.designation_id = d.id
          WHERE e.status = 'active'
            ${departmentFilter}
            ${employmentTypeFilter}
          ORDER BY e.name ASC
        `;

        const params = [
          ...(filters.department ? [filters.department] : []),
          ...(filters.employmentType ? [filters.employmentType] : [])
        ];

        const rows = await executeQuery(query, params);

        results = rows.map(row => ({
          name: row.name,
          designation: row.designation,
          department: row.department,
          employmentType: row.employment_type,
          status: row.status
        }));
        break;
      }

      case 'TASK_SUMMARY': {
        const { dateRangeStart, dateRangeEnd } = filters;
        const statusFilter = filters.status ? `AND t.status = ?` : '';
        const priorityFilter = filters.priority ? `AND t.priority = ?` : '';

        const query = `
          SELECT
            t.id as taskId,
            t.title,
            u.name as assignee,
            t.due_date as dueDate,
            t.status,
            t.priority,
            t.estimated_hours as estimatedHours,
            t.description
          FROM tasks t
          LEFT JOIN users u ON t.assigned_to = u.id
          WHERE t.due_date BETWEEN ? AND ?
            ${statusFilter}
            ${priorityFilter}
          ORDER BY t.due_date ASC
        `;

        const params = [
          dateRangeStart,
          dateRangeEnd,
          ...(filters.status ? [filters.status] : []),
          ...(filters.priority ? [filters.priority] : [])
        ];

        const rows = await executeQuery(query, params);

        results = rows.map(row => ({
          taskId: row.taskId,
          title: row.title,
          assignee: row.assignee,
          dueDate: row.dueDate,
          status: row.status,
          priority: row.priority,
          estimatedHours: Number(row.estimatedHours || 0),
          description: row.description
        }));
        break;
      }

      case 'CUTTING_PERFORMANCE': {
        const startDate = filters.dateRangeStart ? new Date(filters.dateRangeStart) : null;
        const endDate = filters.dateRangeEnd ? new Date(filters.dateRangeEnd) : null;
        const contractorFilter = filters.contractor ? 'AND cc.id = ?' : '';

        const query = `
          SELECT
            cc.name as contractorName,
            SUM(ct.area_covered) as areaCovered,
            AVG(ct.progress) as efficiency
          FROM cutting_tasks ct
          JOIN land_assignments la ON ct.assignment_id = la.id
          JOIN cutting_contractors cc ON la.contractor_id = cc.id
          WHERE la.status = 'completed'
            ${startDate ? 'AND ct.date >= ?' : ''}
            ${endDate ? 'AND ct.date <= ?' : ''}
            ${contractorFilter}
          GROUP BY cc.id, cc.name
          ORDER BY efficiency DESC
        `;

        const params = [
          ...(startDate ? [startDate.toISOString().split('T')[0]] : []),
          ...(endDate ? [endDate.toISOString().split('T')[0]] : []),
          ...(filters.contractor ? [filters.contractor] : [])
        ];

        const [rows] = await pool.execute(query, params);

        results = rows.map(row => ({
          contractorName: row.contractorName,
          areaCovered: Number(row.areaCovered || 0),
          efficiency: Number(row.efficiency || 0)
        }));
        break;
      }

      case 'MANUFACTURING_ADVANCED': {
        const dateFilter = filters.dateRange ? new Date(filters.dateRange) : null;
        const query = `
          SELECT
            p.id,
            p.name as productLine,
            SUM(mo.quantity) as outputQuantity,
            AVG(mo.defect_rate) as defectRate,
            AVG(mo.efficiency) as efficiency,
            SUM(mo.downtime_hours) as downtime,
            AVG(mo.cost_per_unit) as costPerUnit
          FROM manufacturing_orders mo
          JOIN products p ON mo.product_id = p.id
          WHERE mo.status = 'completed'
          ${dateFilter ? 'AND DATE(mo.production_date) = ?' : ''}
          ${filters.productLine ? 'AND p.id = ?' : ''}
          ${filters.efficiency ?
            filters.efficiency === 'high' ? 'AND mo.efficiency > 0.9' :
            filters.efficiency === 'medium' ? 'AND mo.efficiency BETWEEN 0.7 AND 0.9' :
            filters.efficiency === 'low' ? 'AND mo.efficiency < 0.7' : ''
          : ''}
          GROUP BY p.id, p.name
          ORDER BY p.name`;

        const params = [
          ...(dateFilter ? [dateFilter.toISOString().split('T')[0]] : []),
          ...(filters.productLine ? [filters.productLine] : [])
        ];

        const rows = await executeQuery(query, params);

        results = rows.map(row => ({
          productLine: row.productLine,
          outputQuantity: Number(row.outputQuantity || 0),
          defectRate: Number(row.defectRate || 0),
          efficiency: Number(row.efficiency || 0),
          downtime: Number(row.downtime || 0),
          costPerUnit: Number(row.costPerUnit || 0)
        }));
        break;
      }

      case 'MANUFACTURING_PURCHASING': {
        const query = `
          SELECT
            i.id as materialId,
            i.product_name as materialCode,
            i.product_name as materialName,
            i.category as materialCategory,
            SUM(pi.net_weight) as quantity,
            AVG(pi.rate) as unitPrice,
            SUM(pi.amount) as totalCost,
            AVG(DATEDIFF(piv.due_date, piv.invoice_date)) as deliveryTime,
            COUNT(DISTINCT piv.id) as orderCount,
            MIN(pi.rate) as minPrice,
            MAX(pi.rate) as maxPrice,
            AVG(pi.amount) as averageOrderValue
          FROM purchase_items pi
          JOIN purchase_invoices piv ON pi.invoice_id = piv.id
          JOIN inventory i ON pi.grade_id = i.id
          WHERE 1=1
            ${filters.dateRange ? 'AND DATE(piv.invoice_date) = ?' : ''}
            ${filters.materialCategory ? 'AND i.category = ?' : ''}
          GROUP BY i.id, i.product_name, i.category
          ORDER BY i.product_name
          LIMIT 10
        `;

        const params = [
          ...(filters.dateRange ? [new Date(filters.dateRange).toISOString().split('T')[0]] : []),
          ...(filters.materialCategory ? [filters.materialCategory] : [])
        ];

        console.log('Executing MANUFACTURING_PURCHASING query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('MANUFACTURING_PURCHASING results:', rows);

        results = rows.map(row => ({
          materialId: row.materialId,
          materialCode: row.materialCode,
          materialName: row.materialName,
          materialCategory: row.materialCategory,
          quantity: Number(row.quantity || 0),
          unitPrice: Number(row.unitPrice || 0),
          totalCost: Number(row.totalCost || 0),
          deliveryTime: Number(row.deliveryTime || 0),
          orderCount: Number(row.orderCount || 0),
          minPrice: Number(row.minPrice || 0),
          maxPrice: Number(row.maxPrice || 0),
          averageOrderValue: Number(row.averageOrderValue || 0)
        }));
        break;
      }

      default:
        return res.status(400).json({ message: 'Unsupported report type' });
    }

    // Handle different output formats
    switch (format.toLowerCase()) {
      case 'json':
        return res.json(results);

      case 'excel': {
        if (!ExcelJS) {
          throw new Error('Excel export is not available');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(template.name[language]);

        // Set up columns based on template
        worksheet.columns = template.columns.map(col => ({
          header: col.header[language],
          key: col.field,
          width: 15,
          style: {
            numFmt: getExcelFormat(col.format, currency)
          }
        }));

        // Add data rows
        results.forEach(row => {
          const formattedRow = {};
          template.columns.forEach(col => {
            formattedRow[col.field] = formatValue(row[col.field], col.format, currency);
          });
          worksheet.addRow(formattedRow);
        });

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Set response headers
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${code}_${Date.now()}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        return res.end();
      }

      case 'pdf': {
        if (!PDFDocument) {
          throw new Error('PDF export is not available');
        }

        const doc = new PDFDocument();

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${code}_${new Date().toISOString().split('T')[0]}.pdf`
        );

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add title
        doc.fontSize(16).text(template.name[language], { align: 'center' });
        doc.moveDown();

        // Add date
        doc.fontSize(10).text(
          `Generated on: ${new Date().toLocaleDateString()}`,
          { align: 'right' }
        );
        doc.moveDown();

        // Create table header
        const headers = template.columns.map(col => col.header[language]);
        const tableTop = doc.y;
        let currentY = tableTop;

        // Calculate column widths
        const pageWidth = doc.page.width - 100; // margins
        const columnWidth = pageWidth / headers.length;

        // Draw headers
        headers.forEach((header, i) => {
          doc.fontSize(10)
             .text(header,
                  50 + (i * columnWidth),
                  currentY,
                  { width: columnWidth, align: 'left' });
        });

        currentY += 20;
        doc.moveTo(50, currentY).lineTo(50 + pageWidth, currentY).stroke();
        currentY += 10;

        // Add data rows
        results.forEach(row => {
          template.columns.forEach((col, i) => {
            const value = formatValue(row[col.field], col.format, currency);
            doc.fontSize(10)
               .text(value.toString(),
                    50 + (i * columnWidth),
                    currentY,
                    { width: columnWidth, align: 'left' });
          });
          currentY += 20;

          // Add new page if needed
          if (currentY > doc.page.height - 50) {
            doc.addPage();
            currentY = 50;
          }
        });

        // Finalize PDF
        doc.end();
        return;
      }

      default:
        return res.json(results);
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Helper functions
function getExcelFormat(format, currency) {
  switch (format) {
    case 'currency':
      return `"${currency.symbol} "#,##0.00_);("${currency.symbol} "#,##0.00)`;
    case 'number':
      return '#,##0_);(#,##0)';
    case 'percentage':
      return '0.00%';
    case 'date':
      return 'yyyy-mm-dd';
    default:
      return '@';
  }
}

function formatValue(value, format, currency) {
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'currency': {
      if (typeof value !== 'number') return value;

      const absValue = Math.abs(value);
      let formattedValue;

      if (absValue >= 1000000) {
        formattedValue = (value / 1000000).toFixed(2) + 'M';
      } else if (absValue >= 1000) {
        formattedValue = (value / 1000).toFixed(1) + 'K';
      } else {
        formattedValue = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value);
      }

      return `${currency.symbol}${formattedValue}`;
    }
    case 'number':
      return typeof value === 'number' ?
        new Intl.NumberFormat('en-US').format(value) :
        value;
    case 'percentage':
      return typeof value === 'number' ?
        `${(value * 100).toFixed(2)}%` :
        value;
    case 'date':
      return value instanceof Date ?
        value.toISOString().split('T')[0] :
        value;
    default:
      return value;
  }
}

// Get financial reports
router.get('/', protect, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Report type, start date, and end date are required'
      });
    }

    switch (type) {
      case 'financial': {
        // Get transactions within date range
        const [transactions] = await Transaction.pool.execute(`
          SELECT t.*,
                 te.account_id,
                 te.debit,
                 te.credit,
                 a.type as account_type,
                 a.category as account_category
          FROM transactions t
          JOIN transactions_entries te ON t.id = te.transaction_id
          JOIN accounts a ON te.account_id = a.id
          WHERE t.status = 'posted'
            AND t.date BETWEEN ? AND ?
        `, [startDate, endDate]);

        // Get current account balances
        const [accounts] = await Account.pool.execute(
          'SELECT * FROM accounts WHERE status = "active"'
        );

        const report = {
          period: { startDate, endDate },
          profitLoss: {
            revenue: 0,
            expenses: 0,
            netProfit: 0
          },
          balanceSheet: {
            assets: {
              current: [],
              fixed: [],
              totalCurrent: 0,
              totalFixed: 0,
              total: 0
            },
            liabilities: {
              current: [],
              longTerm: [],
              totalCurrent: 0,
              totalLongTerm: 0,
              total: 0
            },
            equity: {
              items: [],
              total: 0
            }
          },
          cashFlow: {
            operating: 0,
            investing: 0,
            financing: 0,
            netCashFlow: 0
          },
          ratios: {
            currentRatio: 0,
            quickRatio: 0,
            debtToEquity: 0,
            returnOnAssets: 0,
            returnOnEquity: 0
          }
        };

        // Calculate financial metrics
        transactions.forEach(entry => {
          // Add calculations here based on entry.account_type and entry.account_category
        });

        accounts.forEach(account => {
          // Add balance sheet calculations here
        });

        res.json(report);
        break;
      }
      default:
        res.status(400).json({ message: 'Invalid report type' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Task Report Generation
router.post('/generate/TASK_SUMMARY', protect, async (req, res) => {
  try {
    const { filters } = req.body;

    let query = `
      SELECT
        t.id as taskId,
        t.title,
        u.name as assignee,
        t.due_date as dueDate,
        t.status,
        t.completion_rate as completionRate
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE 1=1
    `;

    const queryParams = [];

    if (filters.dateRange) {
      query += ` AND t.due_date BETWEEN ? AND ?`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
    }

    if (filters.status) {
      query += ` AND t.status = ?`;
      queryParams.push(filters.status);
    }

    if (filters.priority) {
      query += ` AND t.priority = ?`;
      queryParams.push(filters.priority);
    }

    const [rows] = await pool.execute(query, queryParams);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manufacturing Advanced Report
router.post('/generate/MANUFACTURING_ADVANCED', protect, async (req, res) => {
  try {
    const { filters } = req.body;

    let query = `
      SELECT
        p.id,
        p.name as productLine,
        SUM(mo.quantity) as outputQuantity,
        AVG(mo.defect_rate) as defectRate,
        AVG(mo.efficiency) as efficiency,
        SUM(mo.downtime_hours) as downtime,
        AVG(mo.cost_per_unit) as costPerUnit
      FROM manufacturing_orders mo
      JOIN products p ON mo.product_id = p.id
      WHERE mo.status = 'completed'
    `;

    const queryParams = [];

    if (filters.dateRange) {
      query += ` AND mo.production_date BETWEEN ? AND ?`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
    }

    if (filters.productLine) {
      query += ` AND p.id = ?`;
      queryParams.push(filters.productLine);
    }

    if (filters.efficiency) {
      switch(filters.efficiency) {
        case 'high':
          query += ` AND mo.efficiency > 0.9`;
          break;
        case 'medium':
          query += ` AND mo.efficiency BETWEEN 0.7 AND 0.9`;
          break;
        case 'low':
          query += ` AND mo.efficiency < 0.7`;
          break;
      }
    }

    // Add GROUP BY clause
    query += ` GROUP BY p.id, p.name`;

    const rows = await executeQuery(query, queryParams);

    const results = rows.map(row => ({
      productLine: row.productLine,
      outputQuantity: Number(row.outputQuantity || 0),
      defectRate: Number(row.defectRate || 0),
      efficiency: Number(row.efficiency || 0),
      downtime: Number(row.downtime || 0),
      costPerUnit: Number(row.costPerUnit || 0)
    }));

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manufacturing Purchasing Report
router.post('/generate/MANUFACTURING_PURCHASING', protect, async (req, res) => {
  try {
    const { filters } = req.body;

    let query = `
      SELECT
        i.code as materialCode,
        i.name as materialName,
        SUM(po.quantity) as quantity,
        AVG(po.unit_price) as unitPrice,
        SUM(po.quantity * po.unit_price) as totalCost,
        AVG(DATEDIFF(po.delivery_date, po.order_date)) as deliveryTime
      FROM purchase_orders po
      JOIN inventory i ON po.material_id = i.id
      WHERE po.status = 'completed'
    `;

    const queryParams = [];

    if (filters.dateRange) {
      const date = new Date(filters.dateRange);
      query += ` AND DATE(po.order_date) = ?`;
      queryParams.push(date.toISOString().split('T')[0]);
    }

    if (filters.materialCategory) {
      query += ` AND i.category = ?`;
      queryParams.push(filters.materialCategory);
    }

    query += ` GROUP BY i.id, i.code, i.name
               ORDER BY i.name`;

    const rows = await executeQuery(query, queryParams);

    const results = rows.map(row => ({
      materialCode: row.materialCode,
      materialName: row.materialName,
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unitPrice || 0),
      totalCost: Number(row.totalCost || 0),
      deliveryTime: Number(row.deliveryTime || 0)
    }));

    res.json(results);
  } catch (error) {
    console.error('Error generating manufacturing purchasing report:', error);
    res.status(500).json({ message: error.message });
  }
});

// Preview report
router.post('/preview/:code', protect, async (req, res) => {
  try {
    const { code } = req.params;
    const { filters = {}, language = 'en' } = req.body;

    console.log('Preview request:', { code, filters, language });

    // Get currency settings using direct query
    const [settingsRows] = await pool.execute('SELECT * FROM settings LIMIT 1');
    const settings = settingsRows[0];

    if (!settings || !settings.default_currency) {
      return res.status(500).json({ message: 'Currency settings not configured' });
    }
    const currency = {
      code: settings.default_currency,
      symbol: settings.currency_symbol || '$'  // Fallback to $ if not set
    };

    // Find the report template
    const template = reportTemplates.find(t => t.code === code);
    if (!template) {
      return res.status(404).json({ message: 'Report template not found' });
    }

    // Execute query based on report type
    let results;
    switch (code) {
      case 'SALES_SUMMARY': {
        // Make the date filter optional
        const dateFilter = filters.dateRange ? new Date(filters.dateRange) : null;
        const query = `
          SELECT
            DATE(t.date) as date,
            SUM(te.credit - te.debit) as totalSales,
            COUNT(DISTINCT t.id) as itemCount,
            COUNT(DISTINCT te.id) as transactionCount,
            AVG(te.credit - te.debit) as averageSale,
            MAX(te.credit - te.debit) as maxSale,
            MIN(te.credit - te.debit) as minSale
          FROM transactions t
          JOIN transactions_entries te ON t.id = te.transaction_id
          JOIN accounts a ON te.account_id = a.id
          WHERE a.type = 'revenue'
          ${dateFilter ? 'AND DATE(t.date) >= ?' : ''}
          GROUP BY DATE(t.date)
          ORDER BY date DESC
          LIMIT 10
        `;

        const params = [
          ...(dateFilter ? [dateFilter.toISOString().split('T')[0]] : [])
        ];

        console.log('Executing SALES_SUMMARY query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('SALES_SUMMARY results:', rows);

        results = rows.map(row => ({
          date: row.date,
          totalSales: Number(row.totalSales || 0),
          itemCount: Number(row.itemCount || 0),
          transactionCount: Number(row.transactionCount || 0),
          averageSale: Number(row.averageSale || 0),
          maxSale: Number(row.maxSale || 0),
          minSale: Number(row.minSale || 0)
        }));
        break;
      }

      case 'EMPLOYEE_SUMMARY': {
        const departmentFilter = filters.department ? `AND d.department = ?` : '';
        const employmentTypeFilter = filters.employmentType ? `AND e.employment_type = ?` : '';

        const query = `
          SELECT
            e.name,
            d.title as designation,
            d.department,
            e.employment_type,
            e.status
          FROM employees e
          JOIN designations d ON e.designation_id = d.id
          WHERE 1=1
            ${departmentFilter}
            ${employmentTypeFilter}
          ORDER BY e.name ASC
          LIMIT 10
        `;

        const params = [
          ...(filters.department ? [filters.department] : []),
          ...(filters.employmentType ? [filters.employmentType] : [])
        ];

        console.log('Executing EMPLOYEE_SUMMARY query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('EMPLOYEE_SUMMARY results:', rows);

        results = rows.map(row => ({
          name: row.name,
          designation: row.designation,
          department: row.department,
          employmentType: row.employment_type,
          status: row.status
        }));
        break;
      }

      case 'TASK_SUMMARY': {
        const { dateRangeStart, dateRangeEnd } = filters;
        const statusFilter = filters.status ? `AND t.status = ?` : '';
        const priorityFilter = filters.priority ? `AND t.priority = ?` : '';

        const query = `
          SELECT
            t.id as taskId,
            t.title,
            u.name as assignee,
            t.due_date as dueDate,
            t.status,
            t.priority,
            t.estimated_hours as estimatedHours,
            t.description
          FROM tasks t
          LEFT JOIN users u ON t.assigned_to = u.id
          WHERE 1=1
            ${dateRangeStart && dateRangeEnd ? 'AND t.due_date BETWEEN ? AND ?' : ''}
            ${statusFilter}
            ${priorityFilter}
          ORDER BY t.due_date ASC
          LIMIT 10
        `;

        const params = [
          ...(dateRangeStart && dateRangeEnd ? [dateRangeStart, dateRangeEnd] : []),
          ...(filters.status ? [filters.status] : []),
          ...(filters.priority ? [filters.priority] : [])
        ];

        console.log('Executing TASK_SUMMARY query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('TASK_SUMMARY results:', rows);

        results = rows.map(row => ({
          taskId: row.taskId,
          title: row.title,
          assignee: row.assignee,
          dueDate: row.dueDate,
          status: row.status,
          priority: row.priority,
          estimatedHours: Number(row.estimatedHours || 0),
          description: row.description
        }));
        break;
      }

      case 'CUTTING_PERFORMANCE': {
        const startDate = filters.dateRangeStart ? new Date(filters.dateRangeStart) : null;
        const endDate = filters.dateRangeEnd ? new Date(filters.dateRangeEnd) : null;
        const contractorFilter = filters.contractor ? 'AND cc.id = ?' : '';

        const query = `
          SELECT
            cc.name as contractorName,
            SUM(ct.area_covered) as areaCovered,
            AVG(ct.progress) as efficiency
          FROM cutting_tasks ct
          JOIN land_assignments la ON ct.assignment_id = la.id
          JOIN cutting_contractors cc ON la.contractor_id = cc.id
          WHERE 1=1
            ${startDate ? 'AND ct.date >= ?' : ''}
            ${endDate ? 'AND ct.date <= ?' : ''}
            ${contractorFilter}
          GROUP BY cc.id, cc.name
          ORDER BY efficiency DESC
          LIMIT 10
        `;

        const params = [
          ...(startDate ? [startDate.toISOString().split('T')[0]] : []),
          ...(endDate ? [endDate.toISOString().split('T')[0]] : []),
          ...(filters.contractor ? [filters.contractor] : [])
        ];

        console.log('Executing CUTTING_PERFORMANCE query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('CUTTING_PERFORMANCE results:', rows);

        results = rows.map(row => ({
          contractorName: row.contractorName,
          areaCovered: Number(row.areaCovered || 0),
          efficiency: Number(row.efficiency || 0)
        }));
        break;
      }

      case 'MANUFACTURING_ADVANCED': {
        const dateFilter = filters.dateRange ? new Date(filters.dateRange) : null;
        const query = `
          SELECT
            p.id,
            p.name as productLine,
            SUM(mo.quantity) as outputQuantity,
            AVG(mo.defect_rate) as defectRate,
            AVG(mo.efficiency) as efficiency,
            SUM(mo.downtime_hours) as downtime,
            AVG(mo.cost_per_unit) as costPerUnit
          FROM manufacturing_orders mo
          JOIN products p ON mo.product_id = p.id
          WHERE 1=1
            ${dateFilter ? 'AND DATE(mo.production_date) = ?' : ''}
            ${filters.productLine ? 'AND p.id = ?' : ''}
            ${filters.efficiency ?
              filters.efficiency === 'high' ? 'AND mo.efficiency > 0.9' :
              filters.efficiency === 'medium' ? 'AND mo.efficiency BETWEEN 0.7 AND 0.9' :
              filters.efficiency === 'low' ? 'AND mo.efficiency < 0.7' : ''
            : ''}
          GROUP BY p.id, p.name
          ORDER BY p.name
          LIMIT 10
        `;

        const params = [
          ...(dateFilter ? [dateFilter.toISOString().split('T')[0]] : []),
          ...(filters.productLine ? [filters.productLine] : [])
        ];

        console.log('Executing MANUFACTURING_ADVANCED query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('MANUFACTURING_ADVANCED results:', rows);

        results = rows.map(row => ({
          productLine: row.productLine,
          outputQuantity: Number(row.outputQuantity || 0),
          defectRate: Number(row.defectRate || 0),
          efficiency: Number(row.efficiency || 0),
          downtime: Number(row.downtime || 0),
          costPerUnit: Number(row.costPerUnit || 0)
        }));
        break;
      }

      case 'MANUFACTURING_PURCHASING': {
        const query = `
          SELECT
            i.id as materialId,
            i.product_name as materialCode,
            i.product_name as materialName,
            i.category as materialCategory,
            SUM(pi.net_weight) as quantity,
            AVG(pi.rate) as unitPrice,
            SUM(pi.amount) as totalCost,
            AVG(DATEDIFF(piv.due_date, piv.invoice_date)) as deliveryTime,
            COUNT(DISTINCT piv.id) as orderCount,
            MIN(pi.rate) as minPrice,
            MAX(pi.rate) as maxPrice,
            AVG(pi.amount) as averageOrderValue
          FROM purchase_items pi
          JOIN purchase_invoices piv ON pi.invoice_id = piv.id
          JOIN inventory i ON pi.grade_id = i.id
          WHERE 1=1
            ${filters.dateRange ? 'AND DATE(piv.invoice_date) = ?' : ''}
            ${filters.materialCategory ? 'AND i.category = ?' : ''}
          GROUP BY i.id, i.product_name, i.category
          ORDER BY i.product_name
          LIMIT 10
        `;

        const params = [
          ...(filters.dateRange ? [new Date(filters.dateRange).toISOString().split('T')[0]] : []),
          ...(filters.materialCategory ? [filters.materialCategory] : [])
        ];

        console.log('Executing MANUFACTURING_PURCHASING query:', query, 'with params:', params);
        const rows = await executeQuery(query, params);
        console.log('MANUFACTURING_PURCHASING results:', rows);

        results = rows.map(row => ({
          materialId: row.materialId,
          materialCode: row.materialCode,
          materialName: row.materialName,
          materialCategory: row.materialCategory,
          quantity: Number(row.quantity || 0),
          unitPrice: Number(row.unitPrice || 0),
          totalCost: Number(row.totalCost || 0),
          deliveryTime: Number(row.deliveryTime || 0),
          orderCount: Number(row.orderCount || 0),
          minPrice: Number(row.minPrice || 0),
          maxPrice: Number(row.maxPrice || 0),
          averageOrderValue: Number(row.averageOrderValue || 0)
        }));
        break;
      }

      default:
        return res.status(400).json({ message: 'Unsupported report type' });
    }

    // Return preview data with more information
    const response = {
      preview: true,
      total: results.length,
      isPartial: results.length === 10,
      data: results,
      filters: filters,
      template: {
        code: template.code,
        name: template.name
      }
    };

    console.log('Sending response:', response);
    return res.json(response);

  } catch (error) {
    console.error('Report preview error:', error);
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;