import { StyleSheet } from "@react-pdf/renderer";

// Light theme for factory-ready printing
export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    color: "#1a1a2e",
  },
  // Header on each page
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#22d3ee",
  },
  brandText: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  brandAccent: {
    color: "#22d3ee",
  },
  pageNumber: {
    fontSize: 8,
    color: "#94a3b8",
  },
  // Cover page
  coverContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
  },
  coverDate: {
    fontSize: 10,
    color: "#94a3b8",
  },
  coverImage: {
    width: 300,
    height: 300,
    objectFit: "contain",
    marginBottom: 24,
    borderRadius: 8,
  },
  // Section headers
  sectionHeader: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: "#22d3ee",
  },
  sectionSubheader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    marginBottom: 8,
    marginTop: 12,
  },
  // Tables
  tableContainer: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },
  tableCell: {
    fontSize: 9,
    color: "#334155",
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  // Views grid
  viewsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  viewCard: {
    width: "30%",
    marginBottom: 8,
  },
  viewImage: {
    width: "100%",
    height: 140,
    objectFit: "contain",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  viewLabel: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 4,
    textAlign: "center",
  },
  // Text styles
  bodyText: {
    fontSize: 10,
    color: "#334155",
    lineHeight: 1.5,
    marginBottom: 8,
  },
  label: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "Helvetica-Bold",
  },
  // Category badge
  categoryBadge: {
    fontSize: 7,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    color: "#475569",
  },
  // Info row
  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  infoLabel: {
    width: 120,
    fontSize: 9,
    color: "#64748b",
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
    color: "#0f172a",
  },
});
