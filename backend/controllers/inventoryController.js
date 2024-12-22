const Inventory = require('../models/domain/Inventory');
const { validateInventory, validateTransaction } = require('../validators/inventoryValidator');

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private
exports.getInventoryItems = async (req, res) => {
  try {
    let query = 'SELECT * FROM inventory';
    const params = [];

    if (req.query.type) {
      query += ' WHERE product_type = ?';
      params.push(req.query.type);
    }

    const [items] = await Inventory.pool.execute(query, params);
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private
exports.getInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create inventory item
// @route   POST /api/inventory
// @access  Private/Admin
exports.createInventoryItem = async (req, res) => {
  try {
    const { error } = validateInventory(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const existingItem = await Inventory.findByProductName(req.body.product_name);
    if (existingItem) {
      return res.status(400).json({ message: 'Product name already exists' });
    }

    const item = await Inventory.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private/Admin
exports.updateInventoryItem = async (req, res) => {
  try {
    // Check if this is a partial update (like status change only)
    const isPartialUpdate = Object.keys(req.body).length === 1 && req.body.status;
    
    const { error } = validateInventory(req.body, isPartialUpdate);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    if (req.body.product_name && req.body.product_name !== item.product_name) {
      const existingItem = await Inventory.findByProductName(req.body.product_name);
      if (existingItem) {
        return res.status(400).json({ message: 'Product name already exists' });
      }
    }

    // For partial updates, merge with existing data
    const updateData = isPartialUpdate ? { ...item, ...req.body } : req.body;
    const updatedItem = await Inventory.update(req.params.id, updateData);
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Create inventory transaction
// @route   POST /api/inventory/transactions
// @access  Private/Admin
exports.createInventoryTransaction = async (req, res) => {
  try {
    const { error } = validateTransaction(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { type, item_id, quantity, entries } = req.body;
    const item = await Inventory.findById(item_id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Start transaction
    await Inventory.pool.beginTransaction();
    try {
      // First, get the account IDs from their codes
      const accountCodes = entries.map(entry => entry.account_id);
      const [accounts] = await Inventory.pool.execute(
        'SELECT id, code FROM accounts WHERE code IN (?)',
        [accountCodes]
      );

      // Create a map of account codes to IDs
      const accountMap = accounts.reduce((acc, account) => {
        acc[account.code] = account.id;
        return acc;
      }, {});

      // Create inventory transaction
      const [result] = await Inventory.pool.execute(
        'INSERT INTO inventory_transactions SET ?',
        [req.body]
      );

      // Create transaction entries with mapped account IDs
      for (const entry of entries) {
        const accountId = accountMap[entry.account_id];
        if (!accountId) {
          throw new Error(`Account not found with code: ${entry.account_id}`);
        }

        await Inventory.pool.execute(
          `INSERT INTO transactions_entries (
            transaction_id, account_id, description, debit, credit
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            result.insertId,
            accountId,
            entry.description,
            entry.debit,
            entry.credit
          ]
        );
      }

      // Update inventory quantity
      let newQuantity = item.quantity;
      if (type === 'IN') {
        newQuantity += quantity;
      } else if (type === 'OUT') {
        if (quantity > item.quantity) {
          throw new Error('Insufficient stock');
        }
        newQuantity -= quantity;
      }
      await Inventory.updateQuantity(item_id, newQuantity);

      await Inventory.pool.commit();
      res.status(201).json({ ...req.body, id: result.insertId });
    } catch (error) {
      await Inventory.pool.rollback();
      throw error;
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all inventory transactions
// @route   GET /api/inventory/transactions
// @access  Private
exports.getInventoryTransactions = async (req, res) => {
  try {
    const [rows] = await Inventory.pool.execute(`
      SELECT it.*, 
             i.product_name,
             i.unit
      FROM inventory_transactions it
      JOIN inventory i ON it.item_id = i.id
      ORDER BY it.created_at DESC
    `);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Private/Admin
exports.deleteInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Check if there are any active transactions
    const [transactions] = await Inventory.pool.execute(
      'SELECT COUNT(*) as count FROM inventory_transactions WHERE item_id = ?',
      [req.params.id]
    );

    if (transactions[0].count > 0) {
      return res.status(400).json({
        message: 'Cannot delete item with existing transactions. Consider marking it as inactive instead.'
      });
    }

    await Inventory.delete(req.params.id);
    res.status(200).json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 