const Joi = require('joi');

exports.validateInventory = (data, partial = false) => {
  const schema = Joi.object({
    product_name: partial ? Joi.string() : Joi.string().required(),
    category: partial ? Joi.string() : Joi.string().required(),
    product_type: partial ? Joi.string().valid('raw_material', 'finished_good') : Joi.string().valid('raw_material', 'finished_good').required(),
    quantity: partial ? Joi.number().min(0) : Joi.number().min(0).required(),
    unit: partial ? Joi.string() : Joi.string().required(),
    min_stock_level: partial ? Joi.number().min(0) : Joi.number().min(0).required(),
    max_stock_level: partial ? Joi.number().min(0) : Joi.number().min(0).required(),
    location: Joi.string().allow(''),
    purchase_price: partial ? Joi.number().min(0) : Joi.number().min(0).required(),
    selling_price: Joi.number().min(0).allow(null),
    description: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive')
  });

  return schema.validate(data);
};

const manufacturingMaterialSchema = Joi.object({
  order_id: Joi.number().integer().required(),
  material_id: Joi.number().integer().required(),
  quantity_used: Joi.number().positive().required(),
  unit_cost: Joi.number().positive().required()
});

const transactionSchema = Joi.object({
  item_id: Joi.number().integer().required(),
  type: Joi.string().valid('IN', 'OUT', 'ADJUSTMENT').required(),
  quantity: Joi.number().positive().required(),
  reference: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, '')
});

exports.validateTransaction = (data) => transactionSchema.validate(data); 