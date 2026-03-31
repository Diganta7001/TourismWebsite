const Joi = require("joi");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().trim().required().messages({
      "string.empty": "Title is required"
    }),

    description: Joi.string().trim().required().messages({
      "string.empty": "Description is required"
    }),

    country: Joi.string().trim().required().messages({
      "string.empty": "Country is required"
    }),

    price: Joi.number().min(0).required().messages({
      "number.base": "Price must be a number",
      "number.min": "Price cannot be negative",
      "any.required": "Price is required"
    }),

    location: Joi.string().trim().required().messages({
      "string.empty": "Location is required"
    }),

    image: Joi.object({
      url: Joi.string().uri().allow("").messages({
        "string.uri": "Image must be a valid URL"
      })
    }).required()

  }).required()
});