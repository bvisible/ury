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
		frappe.throw(_("CloudPRNT app is not installed"))

	# Get printer name if not provided
	if not printer:
		# Get POS Invoice to find POS Profile
		pos_invoice = frappe.get_doc("POS Invoice", invoice_name)
		pos_profile_name = pos_invoice.pos_profile

		if not pos_profile_name:
			return {
				"success": False,
				"message": _("POS Profile not found on invoice")
			}

		# Get CloudPRNT printer name from POS Profile
		pos_profile = frappe.get_doc("POS Profile", pos_profile_name)

		if not pos_profile.get("cloudprnt_printer") or not pos_profile.get("cloudprnt_printer_name"):
			return {
				"success": False,
				"message": _("CloudPRNT not configured in POS Profile")
			}

		printer = pos_profile.cloudprnt_printer_name

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
