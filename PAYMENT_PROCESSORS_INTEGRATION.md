# Integration Stripe Terminal + TWINT dans URY POS

## Vue d'ensemble

Cette intégration permet d'utiliser Stripe Terminal et TWINT directement depuis le URY POS avec des dialogues de paiement dédiés, incluant un numpad style caisse enregistreuse et le support des paiements partiels multiples.

## Architecture

```
URY POS Frontend (Vue/React)
  ├─ PaymentDialog.tsx (modifié)
  │   ├─ Détection mode de paiement spécial
  │   └─ Ouverture dialogue approprié
  │
  ├─ StripeTerminalDialog.tsx (nouveau)
  │   ├─ PaymentAmountDialog (numpad)
  │   ├─ Sélection terminal
  │   ├─ Monitoring status
  │   └─ Processing/Success/Error states
  │
  ├─ TwintPaymentDialog.tsx (nouveau)
  │   ├─ PaymentAmountDialog (numpad)
  │   ├─ QR code display
  │   ├─ Status polling (200s)
  │   └─ Processing/Success/Error/Timeout states
  │
  └─ API Wrappers
      ├─ stripe-terminal-api.ts → neopay_integration
      └─ twint-api.ts → twint_integration

URY Backend (Python)
  └─ ury_order.py (modifié)
      └─ make_invoice() accepte transaction_id et payment_intent_id
```

## Fichiers créés

### Frontend (URY POS)
1. **`pos/src/lib/stripe-terminal-api.ts`** (263 lignes)
   - Wrapper complet pour neopay_integration
   - Fonctions: connexion, payment intent, status, configuration

2. **`pos/src/lib/twint-api.ts`** (238 lignes)
   - Wrapper complet pour twint_integration
   - Fonctions: création paiement, polling status, vérification

3. **`pos/src/components/PaymentAmountDialog.tsx`** (187 lignes)
   - Numpad style caisse enregistreuse
   - Logique cash register: chaque digit décale à gauche
   - Validation montant maximum

4. **`pos/src/components/StripeTerminalDialog.tsx`** (458 lignes)
   - Flow complet: montant → sélection terminal → processing → success/error
   - Monitoring status terminal (refresh 5s)
   - Animations et états multiples

5. **`pos/src/components/TwintPaymentDialog.tsx`** (408 lignes)
   - Flow complet: montant → QR code → polling → success/error/timeout
   - QR code + lien de paiement
   - Timer 200 secondes avec polling toutes les 2s

### Modifications Frontend
6. **`pos/src/store/pos-store.ts`** (modifié)
   - Ajout configs: `stripeTerminalConfig`, `twintConfig`
   - Tracking: `processorPayments[]`
   - Fonctions: `fetchPaymentProcessorConfigs()`, `isSpecialPaymentMode()`
   - Chargement auto au démarrage

7. **`pos/src/components/PaymentDialog.tsx`** (modifié)
   - Détection modes de paiement spéciaux
   - Boutons "Pay with Terminal" / "Pay with TWINT"
   - Auto-fill montant après paiement réussi
   - Support paiements partiels multiples

### Backend
8. **`ury/ury/doctype/ury_order/ury_order.py`** (modifié)
   - `make_invoice()` accepte `transaction_id` et `payment_intent_id`
   - Stockage références dans Payment Entry

## Configuration requise

### POS Profile Custom Fields
Les champs suivants doivent exister sur le POS Profile (à créer si absents):

```python
custom_fields = {
    "POS Profile": [
        {
            "fieldname": "custom_enable_stripe_terminal",
            "fieldtype": "Check",
            "label": "Enable Stripe Terminal",
            "insert_after": "payments"
        },
        {
            "fieldname": "custom_stripe_mode_of_payment",
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "label": "Stripe Terminal Mode of Payment",
            "depends_on": "eval:doc.custom_enable_stripe_terminal==1",
            "insert_after": "custom_enable_stripe_terminal"
        },
        {
            "fieldname": "custom_stripe_terminal",
            "fieldtype": "Link",
            "options": "Stripe Terminal",
            "label": "Default Stripe Terminal",
            "depends_on": "eval:doc.custom_enable_stripe_terminal==1",
            "insert_after": "custom_stripe_mode_of_payment"
        },
        {
            "fieldname": "custom_enable_twint",
            "fieldtype": "Check",
            "label": "Enable TWINT",
            "insert_after": "custom_stripe_terminal"
        },
        {
            "fieldname": "custom_twint_mode_of_payment",
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "label": "TWINT Mode of Payment",
            "depends_on": "eval:doc.custom_enable_twint==1",
            "insert_after": "custom_enable_twint"
        }
    ]
}
```

### Sales Invoice Payment Entry Custom Fields
Pour stocker les références de transaction:

```python
custom_fields = {
    "Sales Invoice Payment": [
        {
            "fieldname": "custom_transaction_reference",
            "fieldtype": "Data",
            "label": "Transaction Reference",
            "read_only": 1,
            "insert_after": "amount"
        },
        {
            "fieldname": "custom_payment_intent_id",
            "fieldtype": "Data",
            "label": "Payment Intent ID",
            "read_only": 1,
            "insert_after": "custom_transaction_reference"
        }
    ]
}
```

## Utilisation

### Configuration POS Profile

1. Ouvrir POS Profile
2. Cocher "Enable Stripe Terminal"
3. Sélectionner le "Stripe Terminal Mode of Payment" (ex: "Stripe Terminal")
4. Optionnel: Sélectionner un terminal par défaut
5. Cocher "Enable TWINT"
6. Sélectionner le "TWINT Mode of Payment" (ex: "TWINT")
7. Sauvegarder

### Flow utilisateur - Paiement Stripe Terminal

1. User crée commande CHF 30.-
2. Clique "Paiement"
3. PaymentDialog s'ouvre
4. Clique sur bouton "Pay with Terminal" pour Stripe
5. **PaymentAmountDialog** s'ouvre:
   - Montant pré-rempli: CHF 30.00
   - User peut modifier avec numpad (ex: 10.-)
   - Confirme
6. **StripeTerminalDialog** s'ouvre:
   - Liste des terminals online
   - User sélectionne terminal
   - Status terminal affiché (IP, modèle)
   - Clique "Process Payment"
7. **Processing**:
   - Animation "En attente du paiement"
   - Message "Présentez la carte au terminal"
8. **Success**:
   - Animation checkmark vert
   - "Payment Successful!"
   - Retour automatique après 2s
9. **PaymentDialog** mis à jour:
   - Input Stripe: CHF 10.- (disabled, vert)
   - User peut ajouter autres modes:
     - TWINT: CHF 10.-
     - Cash: CHF 10.-
   - Total: CHF 30.- → Bouton "Pay" activé
10. Finalise commande

### Flow utilisateur - Paiement TWINT

1. Clique sur bouton "Pay with TWINT"
2. **PaymentAmountDialog** s'ouvre:
   - Entre montant avec numpad
   - Confirme
3. **TwintPaymentDialog** s'ouvre:
   - QR code affiché
   - Lien de paiement disponible
   - Instructions affichées
4. User clique "Start Monitoring"
5. **Polling** démarre:
   - Status: "Waiting for Payment..."
   - Timer: 00:00 / 03:20
   - Check status toutes les 2s
6. User scanne QR code avec app TWINT
7. Confirme dans l'app
8. **Success** détecté:
   - Animation checkmark vert
   - Retour automatique
9. Montant auto-rempli dans PaymentDialog

### Paiements partiels multiples

Example: Commande CHF 100.-

```
1. Stripe Terminal: CHF 50.-
2. TWINT:           CHF 30.-
3. Cash:            CHF 20.-
Total:              CHF 100.- ✓
```

Chaque paiement:
- Crée sa propre transaction
- Stocke sa référence
- Peut être effectué indépendamment
- S'additionne dans PaymentDialog

## Détails techniques

### Numpad Cash Register

Logique de saisie:
```typescript
// Chaque digit décale les digits précédents vers la gauche
numericValue = (numericValue * 100 * 10 + digit) / 100

// Exemples:
0       → "1" → 0.01
0.01    → "2" → 0.12
0.12    → "3" → 1.23
1.23    → "0" → 12.30
12.30   → "0" → 123.00
```

### Stripe Terminal Status Monitoring

```typescript
// Auto-refresh toutes les 5 secondes
useEffect(() => {
  if (selectedTerminal) {
    const interval = setInterval(() => {
      refreshTerminalStatus(selectedTerminal);
    }, 5000);
    return () => clearInterval(interval);
  }
}, [selectedTerminal]);
```

### TWINT Polling

```typescript
// Poll toutes les 2 secondes, timeout 200 secondes
const pollInterval = 2000;
const timeout = 200 * 1000;

// States: pending → completed | failed | cancelled | timeout
```

### Payment Entry Enhancement

```typescript
// Frontend
const enhancedPayments = payments.map(payment => {
  const transaction = processorTransactions[payment.mode_of_payment];
  if (transaction) {
    return {
      ...payment,
      transaction_id: transaction.transactionId,
      payment_intent_id: transaction.paymentIntentId
    };
  }
  return payment;
});

// Backend (Python)
for d in payments:
    payment_entry = dict(
        mode_of_payment=d["mode_of_payment"],
        amount=d["amount"]
    )

    if d.get("transaction_id"):
        payment_entry["custom_transaction_reference"] = d.get("transaction_id")

    if d.get("payment_intent_id"):
        payment_entry["custom_payment_intent_id"] = d.get("payment_intent_id")

    invoice.append("payments", payment_entry)
```

## Dépendances

### Apps Frappe requis
- **neopay_integration** (déjà installé sur develop)
- **twint_integration** (déjà installé sur develop)

### Frontend
- React 18+
- lucide-react (icons)
- Tailwind CSS
- zustand (state management)
- frappe-js-sdk

## Erreurs communes

### 1. "No terminals available"
- Vérifier que des Stripe Terminals sont configurés
- Vérifier le statut "online" des terminals
- Vérifier la connexion réseau

### 2. "TWINT Settings not found"
- Configurer TWINT Settings doctype
- Vérifier merchant_id et certificat
- Vérifier environment (sandbox/production)

### 3. Payment timeout
- TWINT: timeout après 200s
- User doit compléter paiement dans l'app
- Possibilité de réessayer

### 4. Terminal offline
- Vérifier connexion réseau du terminal
- Redémarrer le terminal si nécessaire
- Sélectionner un autre terminal

## Sécurité

1. **API Keys**: Stockées dans Stripe Settings (encrypted)
2. **Payment Verification**: Toujours vérifier côté backend
3. **Transaction Validation**: Montant, currency, status
4. **Idempotency**: Transaction IDs uniques
5. **Audit Log**: Tous les paiements loggés

## Performance

- **Lazy Loading**: Dialogues chargés à la demande
- **Status Caching**: Terminal status caché 5s
- **Polling Optimization**: TWINT check 2s interval
- **Transaction Tracking**: En mémoire (store)

## Prochaines étapes

1. ✅ Créer custom fields sur POS Profile (via Customize Form)
2. ✅ Créer custom fields sur Sales Invoice Payment
3. ⏳ Tester Stripe Terminal avec hardware réel
4. ⏳ Tester TWINT avec QR code
5. ⏳ Tester paiements partiels multiples
6. ⏳ Tests E2E complets

## Support

Pour toute question ou problème:
1. Vérifier les logs console (frontend)
2. Vérifier Error Log (backend)
3. Vérifier Transaction status (Stripe/TWINT doctypes)
4. Consulter documentation neopay_integration et twint_integration

---

**Date d'implémentation**: 2025-11-13
**Version URY**: Compatible avec version actuelle
**Status**: ✅ Implémentation complète, prêt pour tests
