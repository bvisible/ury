# Stripe Terminal Integration - URY POS v2

## Vue d'ensemble

Ce document décrit l'intégration Stripe Terminal dans URY POS v2. L'implémentation permet le traitement des paiements via des terminaux de paiement Stripe, avec support pour les terminaux réels et simulés.

## Architecture

### Composants principaux

1. **stripe-bridge.ts** - Pont entre l'application et le SDK Stripe Terminal
2. **stripe-terminal-api.ts** - API wrapper pour les appels backend
3. **StripeTerminalDialog.tsx** - Interface utilisateur React pour la gestion des terminaux

### Flux de paiement

```
1. Sélection du terminal
   ├─ Récupération des terminaux depuis ERPNext
   ├─ Initialisation du SDK avec terminalId
   ├─ Découverte des readers via Stripe SDK
   └─ Mappage des readers SDK avec les terminaux ERPNext

2. Configuration
   ├─ Sélection manuelle ou auto-sélection
   ├─ Configuration du simulateur (si mode simulation)
   └─ Validation de l'état en ligne

3. Traitement du paiement
   ├─ Connexion au reader
   ├─ Création du payment intent (backend)
   ├─ Collecte du mode de paiement
   ├─ Traitement du paiement
   └─ Confirmation du succès

4. Gestion des erreurs
   ├─ Retry automatique (max 3 tentatives)
   ├─ Messages d'erreur traduits
   └─ Nettoyage automatique en cas d'échec
```

## Machine à états (FSM)

Le bridge utilise une machine à états finie pour garantir la fiabilité :

```
uninitialized → initializing → ready → discovering → connecting → connected → processing
                    ↓             ↓         ↓           ↓           ↓           ↓
                  error ←────────────────────────────────────────────────────────┘
                    ↓
                  ready / uninitialized
```

### États

- **uninitialized** : SDK non chargé
- **initializing** : Chargement du SDK en cours
- **ready** : SDK prêt, aucun terminal connecté
- **discovering** : Recherche de readers en cours
- **connecting** : Connexion au reader en cours
- **connected** : Reader connecté, prêt pour paiement
- **processing** : Traitement d'un paiement en cours
- **error** : Erreur survenue, nécessite intervention

## Mode Simulateur

### Activation

Le mode simulateur est disponible **uniquement pour les administrateurs** via une checkbox dans l'interface.

### Configuration

```typescript
// Dans stripe-bridge.ts, ligne ~396
state.terminal.setSimulatorConfiguration({
  testCardNumber: '4242424242424242' // Carte de test Stripe (succès)
});
```

### Cartes de test

- **4242 4242 4242 4242** : Paiement réussi
- **4000 0000 0000 0002** : Carte refusée
- **4000 0000 0000 9995** : Fonds insuffisants

## Backend API

### Endpoints utilisés (neopay_integration)

#### 1. `get_connection_token`
```python
@frappe.whitelist()
def get_connection_token(terminal):
    # terminal: Nom du terminal ERPNext (requis)
    # Retourne: Connection token pour SDK
```

#### 2. `create_payment_intent`
```python
@frappe.whitelist()
def create_payment_intent(terminal_id, amount, currency):
    # terminal_id: Nom du terminal ERPNext
    # amount: Montant en centimes (ex: 1050 pour 10.50)
    # currency: Code devise (chf, eur, usd, gbp)
    # Retourne: {client_secret, payment_intent_id, transaction_id}
```

#### 3. `update_transaction_status`
```python
@frappe.whitelist()
def update_transaction_status(payment_intent_id, status, simulated=False):
    # payment_intent_id: ID de l'intention de paiement
    # status: 'succeeded', 'failed', 'cancelled'
    # simulated: Marquer comme paiement simulé
```

## Montants minimums

Les montants minimums sont validés côté frontend :

| Devise | Minimum |
|--------|---------|
| CHF    | 0.50    |
| EUR    | 0.50    |
| USD    | 0.50    |
| GBP    | 0.30    |

## Gestion d'erreurs

### Types d'erreurs

1. **Erreurs de connexion**
   - Terminal non trouvé
   - Terminal hors ligne
   - Perte de connexion inattendue

2. **Erreurs de paiement**
   - Carte refusée
   - Timeout
   - Annulation par l'utilisateur
   - Fonds insuffisants

3. **Erreurs système**
   - SDK non chargé
   - API backend indisponible
   - Paramètres invalides

### Stratégie de retry

- **Maximum 3 tentatives** pour les opérations critiques
- **Compteur d'erreurs** dans le state
- **Reset automatique** après succès
- **Logging détaillé** pour debugging

## Logging

### Niveaux de log

Tous les logs utilisent le préfixe `[StripeTerminalBridge]` :

```typescript
console.log('[StripeTerminalBridge] Info message');
console.warn('[StripeTerminalBridge] Warning message');
console.error('[StripeTerminalBridge] Error message');
```

### Points de logging

1. Transitions d'état
2. Appels API backend
3. Opérations SDK (discover, connect, process)
4. Erreurs et exceptions
5. Validations de données

## Interface utilisateur

### États du dialog

1. **terminal-selection** : Sélection du terminal
2. **amount** : Saisie du montant (via PaymentAmountDialog)
3. **processing** : Traitement en cours
4. **success** : Paiement réussi
5. **error** : Erreur survenue

### Indicateurs visuels

- **Pastille verte pulsante** : Terminal en ligne
- **Pastille rouge** : Terminal hors ligne
- **Badge jaune** : Mode simulation actif
- **Animation de chargement** : Opération en cours
- **Animation bounce** : Succès du paiement

### Traductions

Tous les messages utilisateur sont traduits via la fonction `__()` ou `_()` :

```typescript
__('Veuillez sélectionner un terminal')
__('Paiement réussi !')
__('Échec du paiement')
```

## Configuration requise

### POS Profile

Le POS Profile doit avoir :
- `enable_stripe_terminal` ou `custom_enable_stripe_terminal` = true
- Au moins un Stripe Terminal configuré

### Stripe Terminal DocType

Champs requis :
- `name` : ID du terminal (ex: "Terminal-001")
- `label` : Nom affiché (ex: "Caisse Principale")
- `device_type` : Type d'appareil (ex: "verifone_P400")
- `status` : État (online/offline)
- `ip_address` : Adresse IP (optionnel)
- `serial_number` : Numéro de série (optionnel)

## Sécurité

### Validation des paramètres

- **Terminal ID** : Toujours requis, jamais null/undefined
- **Montant** : Validation min/max selon devise
- **Client secret** : Validé présent dans la réponse

### Permissions

- Mode simulateur : Rôle Administrator uniquement
- API backend : Vérifications de permissions standard Frappe

## Dépannage

### Problème : "Terminal ID is required"

**Cause** : L'API `get_connection_token` est appelée sans paramètre `terminal`

**Solution** : Vérifier que `initializeTerminal(terminalId)` reçoit un terminalId valide

### Problème : "No terminals discovered"

**Causes possibles** :
1. Aucun terminal configuré dans ERPNext
2. Terminaux hors ligne
3. Problème réseau

**Solution** :
1. Vérifier la configuration des terminaux
2. Tester avec le mode simulateur
3. Vérifier les logs du SDK

### Problème : Paiement bloqué en "processing"

**Cause** : Timeout ou erreur non gérée

**Solution** :
1. Vérifier les logs console
2. Vérifier l'état du terminal physique
3. Annuler et réessayer

## Développement

### Tester avec le simulateur

1. Se connecter en tant qu'Administrator
2. Ouvrir le dialog Stripe Terminal
3. Cocher "Use Simulated Terminal (Testing)"
4. Sélectionner le terminal simulé
5. Effectuer un paiement de test

### Activer les logs détaillés

Les logs sont automatiquement activés. Pour filtrer :

```javascript
// Dans la console du navigateur
localStorage.setItem('stripe_debug', 'true');
```

### Build

```bash
cd /Users/jeremy/GitHub/ury/pos
yarn build
```

## Références

- [Stripe Terminal SDK Documentation](https://stripe.com/docs/terminal/sdk/js)
- [Stripe Terminal API](https://stripe.com/docs/terminal)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)

## Support

Pour toute question ou problème :
1. Vérifier les logs dans la console navigateur
2. Consulter ce document
3. Vérifier la configuration du POS Profile et des terminaux
4. Tester avec le mode simulateur pour isoler les problèmes matériels

---

**Dernière mise à jour** : 2025-11-15
**Version** : 2.0.0
