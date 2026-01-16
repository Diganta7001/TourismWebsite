const mongoose = require("mongoose");

const Schema  = mongoose.Schema;
const listingSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  image: {
    filename: {
      type: String,
      default: "listingimage"
    },
    url: {
      type: String,
      default: "https://images.unsplash.com/photo-1761839257469-96c78a7c2dd3?w=500&auto=format&fit=crop&q=60",
      set : (url) => url == "" ? "https://images.unsplash.com/photo-1761839257469-96c78a7c2dd3?w=500&auto=format&fit=crop&q=60" : url
    }
  },
  price: Number,
  location: String,
  country: String
});


const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
