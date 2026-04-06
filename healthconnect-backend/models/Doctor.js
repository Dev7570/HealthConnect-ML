const mongoose = require("mongoose");

const DoctorSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  spec: { type: String, required: true },
  exp: { type: Number, required: true },
  fee: { type: Number, required: true },
  available: { type: String, required: true },
  rating: { type: Number, required: true },
  img: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // NEW: For doctor login
  slots: { type: [String], default: ["9:00 AM", "10:30 AM", "2:00 PM", "4:30 PM"] },
  hospitalId: { type: Number },
  hospitalName: { type: String },
  lat: { type: Number },
  lng: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model("Doctor", DoctorSchema);
