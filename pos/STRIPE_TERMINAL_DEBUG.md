# Stripe Terminal Integration - Debugging Guide

## Architecture Overview

URY POS v2 integrates with Stripe Terminal via the **neopay_integration** Frappe app:

```
URY POS v2 (React/TypeScript)
    ↓
neopay_integration.api.* (Python/Frappe)
    ↓
Stripe API (stripe.com)
    ↓
Stripe Terminal SDK (Physical/Simulated Reader)
```

## Components

### Frontend (URY POS v2)
- **stripe-terminal-api.ts**: API client for neopay_integration backend
- **stripe-bridge.ts**: Stripe Terminal SDK wrapper with FSM
- **StripeTerminalDialog.tsx**: UI component for terminal selection and payment

### Backend (neopay_integration)
- **api.py**: Whitelisted API endpoints
  - `get_connection_token(terminal)`: Returns Stripe connection token
  - `create_payment_intent(terminal_id, amount, currency)`: Creates PaymentIntent
  - `update_transaction_status(payment_intent_id, status, simulated)`: Updates transaction

### DocTypes (neopay_integration)
- **Stripe Terminal**: Terminal configuration (name, label, device_type, status)
- **Stripe Transaction**: Transaction records (payment_intent_id, amount, status, error_message)
- **Stripe Settings**: API keys (publishable_key, secret_key)

---

## Logging System

All logs follow a standardized format with emojis for easy filtering:

### Frontend Logs (Browser Console)

#### [STRIPE] - API Communication
```javascript
[STRIPE] 🔑 getConnectionToken START { terminal: "..." }
[STRIPE] ✅ getConnectionToken SUCCESS { secretPreview: "..." }
[STRIPE] ❌ getConnectionToken ERROR { terminal, error }

[STRIPE] 💰 createPaymentIntent START { amount, currency, terminalId }
[STRIPE] 📤 API Request { endpoint, requestData }
[STRIPE] 📥 API Response received { hasMessage, responseKeys }
[STRIPE] ✅ createPaymentIntent SUCCESS { payment_intent_id, transaction_id }
[STRIPE] ❌ createPaymentIntent ERROR { error, httpStatus, exc_type }

[STRIPE] 🔄 updateTransactionStatus START { mode: "🤖 SIMULATION" | "💳 REAL", paymentIntentId, status }
[STRIPE] ✅ updateTransactionStatus SUCCESS
[STRIPE] ❌ updateTransactionStatus ERROR
```

#### [STRIPE-FSM] - State Machine
```javascript
[STRIPE-FSM] uninitialized → initializing
[STRIPE-FSM] initializing → ready
[STRIPE-FSM] ready → discovering
[STRIPE-FSM] connecting → connected
[STRIPE-FSM] connected → processing
[STRIPE-FSM] processing → connected
[STRIPE-FSM] ⚠️ Invalid transition: processing -> discovering
```

#### [STRIPE-PAYMENT] - Payment Flow
```javascript
[STRIPE-PAYMENT] 🚀 START { mode: "🤖 SIMULATION", amount, terminal }
[STRIPE-PAYMENT] Mode detected: 🤖 SIMULATION { device_type, reader_id }

// Simulation mode
[STRIPE-PAYMENT] 🤖 SIMULATION MODE - Creating fake PaymentIntent
[STRIPE-PAYMENT] ⏳ Simulating 2-second processing delay...
[STRIPE-PAYMENT] ✅ 🤖 Simulated payment SUCCESS { payment_intent_id, status }

// Real mode
[STRIPE-PAYMENT] 💳 REAL MODE - Starting SDK payment flow
[STRIPE-PAYMENT] 📲 Collecting payment method from terminal...
[STRIPE-PAYMENT] ✅ Payment method collected { payment_intent_id }
[STRIPE-PAYMENT] ⚡ Processing payment with Stripe SDK...
[STRIPE-PAYMENT] ✅ 💳 Real payment SUCCESS { payment_intent_id, status, amount }

[STRIPE-PAYMENT] ❌ ERROR { error, message, currentState }
```

#### [STRIPE-UI] - User Interface Events
```javascript
[STRIPE-UI] 🎯 Terminal selected { terminal, device_type, id }
[STRIPE-UI] 💰 Amount confirmed { amount, currency, terminal }
[STRIPE-UI] 🚀 handleProcessPayment START { mode, amount, terminal }
[STRIPE-UI] 🔌 Connecting to terminal: "Terminal Name"
[STRIPE-UI] ✅ Terminal connected
[STRIPE-UI] 🤖 Configuring simulator for success...
[STRIPE-UI] 💰 Creating payment intent...
[STRIPE-UI] 📤 Payment intent request { amount, currency, terminalId, mode }
[STRIPE-UI] ✅ Payment intent created { payment_intent_id, hasClientSecret }
[STRIPE-UI] 📲 Processing payment with terminal...
[STRIPE-UI] ✅ Payment result received { payment_intent_id, status, amount }
[STRIPE-UI] ❌ handleProcessPayment ERROR { error, message, httpStatus }
```

### Backend Logs (Frappe/Bench)

View backend logs via SSH:
```bash
ssh develop.neoffice.me
cd ~/frappe-bench
tail -f logs/bench-start.log | grep STRIPE
```

#### Backend Log Format
```python
[STRIPE] 🔑 get_connection_token START - terminal=Terminal-001
[STRIPE] 🌐 Calling Stripe API - ConnectionToken.create
[STRIPE] ✅ get_connection_token SUCCESS - secret=pst_test_YWNj...

[STRIPE] 💰 create_payment_intent START - terminal=Terminal-001, amount=500, currency=chf
[STRIPE] 🔍 Validating amount - minimum=50, received=500
[STRIPE] 📝 Creating Stripe Transaction DocType
[STRIPE] ✅ Transaction created - STR-TXN-2025-00123
[STRIPE] 🌐 Calling Stripe API - PaymentIntent.create
[STRIPE] ✅ PaymentIntent created - pi_3OabcDEF123456
[STRIPE] ✅ create_payment_intent SUCCESS - pi=pi_3OabcDEF123456, tx=STR-TXN-2025-00123

[STRIPE] 🔄 update_transaction_status START - 🤖 SIMULATION - pi=pi_simulated_1234567890, status=succeeded
[STRIPE] ✅ Transaction status updated - succeeded

[STRIPE] ❌ Stripe API Error: Amount must be at least 0.50 CHF
[STRIPE] ❌ Unexpected error: Terminal not found
```

---

## Troubleshooting

### Error: 404 NOT FOUND - neopay_integration.api.create_payment_intent

**Symptom:**
```
POST https://develop.neoffice.me/api/method/neopay_integration.api.create_payment_intent 404 (NOT FOUND)
[createPaymentIntent] Error caught: {exc_type: 'DoesNotExistError', httpStatus: 404}
```

**Root Cause:** neopay_integration app not installed on the site

**Solution:**
```bash
ssh develop.neoffice.me
cd ~/frappe-bench
bench --site prod.local list-apps | grep neopay_integration
# If not listed:
bench --site prod.local install-app neopay_integration
bench restart
```

---

### Error: Terminal ID is required

**Symptom:**
```
[STRIPE] ❌ Terminal ID missing
Error: L'ID du terminal est requis
```

**Root Cause:** No terminal selected or `terminalId` is undefined

**Solution:**
1. Check POS Profile has Stripe Terminal enabled
2. Verify Stripe Terminal DocType exists and is linked
3. Check browser console for terminal selection:
```javascript
[STRIPE-UI] 🎯 Terminal selected { terminal: "...", device_type: "...", id: "..." }
```

---

### Error: Amount below minimum

**Symptom:**
```
[STRIPE] ❌ Amount below minimum - min=0.50 CHF, received=0.10
Error: Le montant minimum pour CHF est 0.50
```

**Root Cause:** Amount is below Stripe's minimum for the currency

**Minimum Amounts:**
- CHF: 0.50
- EUR: 0.50
- USD: 0.50
- GBP: 0.30

**Solution:** Ensure amount is above minimum before attempting payment

---

### Error: Stripe API key not configured

**Symptom:**
```
[STRIPE] ❌ Stripe API key not configured
Error: La clé API Stripe n'est pas configurée
```

**Root Cause:** Stripe Settings DocType missing or secret_key not set

**Solution:**
```bash
# Via Frappe desk:
1. Go to Stripe Settings
2. Enter publishable_key and secret_key
3. Save

# Or via bench console:
bench --site prod.local console
>>> stripe_settings = frappe.get_doc("Stripe Settings", "Stripe Settings")
>>> stripe_settings.secret_key = "sk_test_..."
>>> stripe_settings.save()
```

---

### Simulation Mode Not Working

**Symptom:**
```
[STRIPE-PAYMENT] Mode detected: 💳 REAL { device_type: "simulated_reader", reader_id: "SIMULATOR" }
```

**Root Cause:** Terminal device_type not set to "simulated" or reader ID not "SIMULATOR"

**Solution:**
1. Verify admin role: Only System Managers can use simulation mode
2. Check terminal selection logs:
```javascript
[STRIPE-UI] 🎯 Terminal selected { device_type: "simulated" }
```
3. Ensure `simulationMode` is enabled in dialog state

---

### Payment Stuck in "Processing"

**Symptom:**
- UI shows "Processing..." indefinitely
- No error in console

**Debug Steps:**

1. **Check FSM state:**
```javascript
// In browser console:
window.StripeTerminalBridge?.getState()
// Should show: { currentState: "processing", isProcessing: true }
```

2. **Check backend transaction:**
```bash
bench --site prod.local console
>>> frappe.db.get_value("Stripe Transaction", {"status": "Processing"}, ["name", "payment_intent_id", "created"])
```

3. **Check backend logs:**
```bash
tail -f ~/frappe-bench/logs/bench-start.log | grep "STRIPE.*processing"
```

4. **Force cancel if stuck:**
```javascript
// Browser console:
await StripeBridge.cancelPayment()
```

---

## Testing Checklist

### 1. Verify Installation
```bash
ssh develop.neoffice.me
cd ~/frappe-bench
bench --site prod.local list-apps | grep -E "ury|neopay_integration"
```
**Expected:** Both apps listed

---

### 2. Test Connection Token (Browser Console)

Navigate to: `https://develop.neoffice.me/pos`

Open browser console (F12) and run:
```javascript
// Get available terminals
const terminals = await frappe.call({
  method: 'frappe.client.get_list',
  args: {
    doctype: 'Stripe Terminal',
    fields: ['name', 'label', 'device_type']
  }
});
console.log('Terminals:', terminals.message);

// Test connection token
const token = await frappe.call({
  method: 'neopay_integration.api.get_connection_token',
  args: { terminal: terminals.message[0].name }
});
console.log('Connection Token:', token.message);
```

**Expected Logs:**
```
[STRIPE] 🔑 getConnectionToken START
[STRIPE] ✅ getConnectionToken SUCCESS { secretPreview: "pst_test_..." }
```

**Backend Logs:**
```
[STRIPE] 🔑 get_connection_token START - terminal=...
[STRIPE] ✅ get_connection_token SUCCESS - secret=pst_test_...
```

---

### 3. Test Payment Intent Creation

```javascript
// Create test payment intent
const paymentIntent = await frappe.call({
  method: 'neopay_integration.api.create_payment_intent',
  args: {
    terminal_id: 'Terminal-001', // Replace with actual terminal
    amount: 500, // 5.00 CHF in cents
    currency: 'chf'
  }
});
console.log('Payment Intent:', paymentIntent.message);
```

**Expected Logs:**
```
[STRIPE] 💰 createPaymentIntent START
[STRIPE] 📤 API Request { endpoint: "neopay_integration.api.create_payment_intent", requestData: {...} }
[STRIPE] ✅ createPaymentIntent SUCCESS { payment_intent_id: "pi_...", transaction_id: "..." }
```

**Backend Logs:**
```
[STRIPE] 💰 create_payment_intent START - terminal=Terminal-001, amount=500, currency=chf
[STRIPE] 🔍 Validating amount - minimum=50, received=500
[STRIPE] 📝 Creating Stripe Transaction DocType
[STRIPE] ✅ Transaction created - STR-TXN-...
[STRIPE] 🌐 Calling Stripe API - PaymentIntent.create
[STRIPE] ✅ PaymentIntent created - pi_...
```

---

### 4. Test Simulated Payment (Admin Only)

1. Navigate to POS: `https://develop.neoffice.me/pos`
2. Open Stripe Terminal dialog
3. Enable "Mode Simulation" toggle (admin only)
4. Select "SIMULATOR" terminal
5. Enter amount (e.g., 5.00 CHF)
6. Click "Confirmer"

**Expected Logs:**
```
[STRIPE-UI] 🚀 handleProcessPayment START { mode: "🤖 SIMULATION", amount: 5, terminal: "SIMULATOR" }
[STRIPE-UI] 🔌 Connecting to terminal: SIMULATOR
[STRIPE-UI] ✅ Terminal connected
[STRIPE-UI] 🤖 Configuring simulator for success...
[STRIPE-UI] 💰 Creating payment intent...
[STRIPE] 💰 createPaymentIntent START
[STRIPE] ✅ createPaymentIntent SUCCESS
[STRIPE-UI] 📲 Processing payment with terminal...
[STRIPE-PAYMENT] 🚀 START { mode: "🤖 SIMULATION" }
[STRIPE-PAYMENT] 🤖 SIMULATION MODE - Creating fake PaymentIntent
[STRIPE-PAYMENT] ⏳ Simulating 2-second processing delay...
[STRIPE-PAYMENT] ✅ 🤖 Simulated payment SUCCESS
[STRIPE] 🔄 updateTransactionStatus START - 🤖 SIMULATION
[STRIPE-UI] ✅ Payment result received
```

**Backend Logs:**
```
[STRIPE] 💰 create_payment_intent START - terminal=SIMULATOR, amount=500, currency=chf
[STRIPE] ✅ create_payment_intent SUCCESS - pi=pi_simulated_..., tx=STR-TXN-...
[STRIPE] 🔄 update_transaction_status START - 🤖 SIMULATION - pi=pi_simulated_..., status=succeeded
```

---

### 5. Test Real Payment (Physical Terminal)

**Prerequisites:**
- Physical Stripe Terminal connected to network
- Terminal registered in Stripe Dashboard
- Terminal linked in Stripe Terminal DocType

**Steps:**
1. Navigate to POS
2. Disable simulation mode
3. Select physical terminal
4. Enter amount
5. Present card to terminal
6. Verify payment completes

**Expected Logs:**
```
[STRIPE-UI] 🚀 handleProcessPayment START { mode: "💳 REAL", ... }
[STRIPE-PAYMENT] 💳 REAL MODE - Starting SDK payment flow
[STRIPE-PAYMENT] 📲 Collecting payment method from terminal...
[STRIPE-PAYMENT] ✅ Payment method collected
[STRIPE-PAYMENT] ⚡ Processing payment with Stripe SDK...
[STRIPE-PAYMENT] ✅ 💳 Real payment SUCCESS
```

---

## Log Filtering Examples

### Browser Console Filtering

**Show only errors:**
```javascript
// In console filter box:
/STRIPE.*❌/
```

**Show only simulation mode:**
```javascript
/🤖/
```

**Show only real payments:**
```javascript
/💳 REAL/
```

**Show FSM transitions:**
```javascript
/STRIPE-FSM/
```

**Show payment flow:**
```javascript
/STRIPE-PAYMENT/
```

### Backend Log Filtering

```bash
# SSH into server
ssh develop.neoffice.me
cd ~/frappe-bench

# Show all Stripe logs
tail -f logs/bench-start.log | grep STRIPE

# Show only errors
tail -f logs/bench-start.log | grep "STRIPE.*❌"

# Show only simulation
tail -f logs/bench-start.log | grep "SIMULATION"

# Show only create_payment_intent
tail -f logs/bench-start.log | grep "create_payment_intent"

# Show last 100 Stripe logs
grep STRIPE logs/bench-start.log | tail -100
```

---

## Common Scenarios

### Scenario 1: New Payment Not Working

**Check these in order:**

1. **Verify neopay_integration installed:**
```bash
bench --site prod.local list-apps | grep neopay_integration
```

2. **Check Stripe Settings exist:**
```bash
bench --site prod.local console
>>> frappe.db.exists("Stripe Settings", "Stripe Settings")
```

3. **Check Terminal exists:**
```bash
>>> frappe.get_all("Stripe Terminal", fields=["name", "label", "status"])
```

4. **Check API keys configured:**
```bash
>>> settings = frappe.get_doc("Stripe Settings", "Stripe Settings")
>>> bool(settings.get_password("secret_key"))
```

5. **Check browser console** for frontend errors

6. **Check backend logs** for API errors

---

### Scenario 2: Simulated Payment Not Recording in DB

**Root Cause:** `updateTransactionStatus` not called for simulated payments

**Solution:** Already fixed in latest code. Update to latest:
```bash
cd /path/to/ury
git pull origin develop
cd pos && yarn build
# Deploy to server
```

**Verify fix:** Check browser logs include:
```
[STRIPE] 🔄 updateTransactionStatus START - 🤖 SIMULATION
```

---

### Scenario 3: Real Terminal Not Connecting

**Debug Steps:**

1. **Check terminal status in Stripe Dashboard:**
   - https://dashboard.stripe.com/terminal/readers
   - Verify status = "Online"

2. **Check terminal configuration:**
```bash
bench --site prod.local console
>>> terminal = frappe.get_doc("Stripe Terminal", "Terminal-Name")
>>> print(f"Status: {terminal.status}, Device Type: {terminal.device_type}")
```

3. **Check network connectivity:**
   - Terminal must be on same network or have internet access
   - Firewall must allow Stripe API connections

4. **Check browser logs:**
```
[STRIPE-FSM] connecting → connected  # Should transition
```

If stuck at "connecting", check terminal is powered on and online.

---

## Configuration Reference

### POS Profile Custom Fields
(Added by neopay_integration)

- `custom_enable_stripe_terminal` (Check): Enable Stripe Terminal
- `custom_stripe_terminal` (Link → Stripe Terminal): Default terminal
- `custom_stripe_mode_of_payment` (Link → Mode of Payment): Stripe payment mode

### Stripe Terminal DocType Fields

- `name`: Internal ID
- `label`: Display name
- `device_type`: "verifone_P400", "bbpos_wisepos_e", "simulated_reader", etc.
- `terminal_id`: Stripe Terminal ID (from Stripe Dashboard)
- `serial_number`: Physical device serial number
- `ip_address`: Terminal IP (optional)
- `location`: Stripe location ID
- `status`: "online", "offline"
- `stripe_settings`: Link to Stripe Settings

### Stripe Transaction DocType Fields

- `payment_intent_id`: Stripe PaymentIntent ID
- `terminal`: Link to Stripe Terminal
- `stripe_settings`: Link to Stripe Settings
- `amount`: Transaction amount (decimal)
- `currency`: Currency code (CHF, EUR, USD, etc.)
- `status`: "Draft", "Processing", "Captured", "Failed", "Cancelled"
- `error_message`: Error details if failed

---

## Support

### Logs to Include in Bug Reports

When reporting issues, include:

1. **Browser console logs** (filtered by `STRIPE`):
   - Right-click console → Save as... → stripe_frontend.log

2. **Backend logs** (last 200 lines):
```bash
ssh develop.neoffice.me
grep STRIPE ~/frappe-bench/logs/bench-start.log | tail -200 > stripe_backend.log
```

3. **Transaction details** (if applicable):
```bash
bench --site prod.local console
>>> tx = frappe.get_doc("Stripe Transaction", "STR-TXN-...")
>>> print(frappe.as_json(tx.as_dict(), indent=2))
```

4. **Environment info:**
```bash
bench version
bench --site prod.local list-apps
```

---

## Changelog

### 2025-01-15 - Comprehensive Logging Added
- ✅ Added standardized [STRIPE] logs with emojis
- ✅ Added mode indicators (🤖 SIMULATION vs 💳 REAL)
- ✅ Added FSM state transition logs
- ✅ Added detailed error logging with httpStatus and exc_type
- ✅ Improved debugging and troubleshooting capabilities

---

## Quick Reference

### Log Emoji Legend
- 🔑 Connection token
- 💰 Payment intent
- 🔄 Transaction status update
- 🔌 Terminal connection
- 📲 Payment method collection
- ⚡ Payment processing
- 🎯 Terminal selection
- 🚀 Process start
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 🤖 Simulation mode
- 💳 Real payment mode
- 🔍 Validation
- 📝 Database operation
- 📤 API request
- 📥 API response
- 🌐 Stripe API call
- ⏳ Waiting/delay

### Key Files
- Frontend: `pos/src/lib/stripe-terminal-api.ts`
- Frontend FSM: `pos/src/lib/stripe-bridge.ts`
- Frontend UI: `pos/src/components/StripeTerminalDialog.tsx`
- Backend: `neopay_integration/neopay_integration/api.py`

### Useful Commands
```bash
# Restart after code changes
bench restart

# Build frontend
cd ~/frappe-bench/apps/ury && bench --site prod.local build --app ury

# View real-time logs
tail -f ~/frappe-bench/logs/bench-start.log | grep STRIPE

# Check app versions
bench --site prod.local list-apps
```
