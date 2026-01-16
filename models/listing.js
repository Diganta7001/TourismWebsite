const mongoose = require("mongoose");

const Schema  = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  image: {
    type: String,
    set: (v) =>
      v === ""
        ? "https://images.unsplash.com/photo-1761839257469-96c78a7c2dd3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDF8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxfHx8ZW58MHx8fHx8"
        : v,
  },
  price: Number,
  location: String,
  country: String,
});

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
