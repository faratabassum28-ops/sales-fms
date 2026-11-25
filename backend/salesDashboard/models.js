import mongoose from "mongoose";

// One document per cleaned enrollment (the DB_Clean rows). `raw` keeps the original sheet columns under their exact header names.
const EnrollmentSchema = new mongoose.Schema({
  syncId: { type: String, index: true },
  sNo: String,
  raw: { type: mongoose.Schema.Types.Mixed },
  date: { type: String, index: true }, // YYYY-MM-DD
  week: String, month: String, quarter: String, year: Number, day: String,
  program: { type: String, index: true },
  pymtStatus: String,
  closedBy: { type: String, index: true }, // "Not Tagged" when blank (dashboard only)
  notTagged: Boolean,
  programFee: Number, bookingAmount: Number, amountReceived: Number, amountDue: Number,
}, { minimize: false, collection: "sd_enrollments" });

const SyncLogSchema = new mongoose.Schema({
  syncId: String, at: { type: Date, default: Date.now }, source: String, ok: Boolean,
  stats: mongoose.Schema.Types.Mixed, error: String,
}, { minimize: false, collection: "sd_synclogs" });

export const Enrollment = mongoose.models.SdEnrollment || mongoose.model("SdEnrollment", EnrollmentSchema);
export const SyncLog = mongoose.models.SdSyncLog || mongoose.model("SdSyncLog", SyncLogSchema);
