import frappe


def before_insert(doc, event):
    validate_mobile_number(doc, event)


def validate_mobile_number(doc, event):
    # Skip validation for webshop customers (those created via shopping cart)
    # Only validate for POS/Restaurant customers
    if frappe.flags.in_test or frappe.flags.in_migrate:
        return

    # Check if this is a webshop customer (created from quotation/shopping cart)
    # Webshop customers may not have mobile numbers initially
    if hasattr(frappe.local, 'request') and frappe.local.request:
        # Skip validation if coming from webshop context
        if '/api/method/webshop' in str(frappe.local.request.url):
            return

    # For POS/Restaurant customers, mobile is mandatory
    # Only enforce for customers created in POS context
    if not doc.mobile_number and doc.customer_type == "Individual":
        # Check if we're in POS context by looking for POS Invoice in the call stack
        if any('POS Invoice' in str(arg) for arg in frappe.local.flags.get('call_stack', [])):
            frappe.throw("Mobile Number is Mandatory")
