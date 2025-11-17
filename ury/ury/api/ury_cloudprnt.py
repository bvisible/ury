import frappe
from frappe import _


@frappe.whitelist()
def cloudprnt_print_invoice(invoice_name, printer=None):
	"""
	Print a POS Invoice using CloudPRNT

	Args:
		invoice_name (str): Name of the POS Invoice to print
		printer (str, optional): Printer name/label or MAC address. If not provided,
								 will be retrieved from the POS Profile

	Returns:
		dict: Result from CloudPRNT print_pos_invoice with success/error status
	"""
	try:
		# Import CloudPRNT API
		from cloudprnt.api import print_pos_invoice
	except ImportError:
		return {
			"success": False,
			"message": _("CloudPRNT app is not installed")
		}

	# Get printer name if not provided
	if not printer:
		# Get POS Invoice to find POS Profile (using SQL to avoid module loading issues)
		pos_profile_name = frappe.db.get_value("POS Invoice", invoice_name, "pos_profile")

		if not pos_profile_name:
			return {
				"success": False,
				"message": _("POS Profile not found on invoice")
			}

		# Get CloudPRNT printer name from POS Profile (using SQL)
		pos_profile = frappe.db.sql("""
			SELECT cloudprnt_printer, cloudprnt_printer_name
			FROM `tabPOS Profile`
			WHERE name = %s
		""", (pos_profile_name,), as_dict=True)

		if not pos_profile or not pos_profile[0].get("cloudprnt_printer") or not pos_profile[0].get("cloudprnt_printer_name"):
			return {
				"success": False,
				"message": _("CloudPRNT not configured in POS Profile")
			}

		printer = pos_profile[0]["cloudprnt_printer_name"]

	# Call CloudPRNT API to print invoice
	result = print_pos_invoice(invoice_name, printer=printer)

	# If successful, update table status if applicable
	if result.get("success"):
		table = frappe.db.get_value("POS Invoice", invoice_name, "restaurant_table")
		if table:
			frappe.db.set_value("URY Table", table, {
				"occupied": 0,
				"latest_invoice_time": None
			})

	return result
