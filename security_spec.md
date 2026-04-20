# Security Specification

## Data Invariants
1. **Menu Invariants**: Only verified Admins can create, update, or delete menu items. Menu item `price` must be >= 0. `name`, `category`, and `image` must be strings.
2. **Order Invariants**: Any user (including anonymous) can create an order. Once created, only an Admin can update its status or payment status. The order structure must perfectly match the expected fields.
3. **Role Invariants**: Admins are defined by existing documents in the `/databases/$(database)/documents/admins/$(request.auth.uid)` path.

## The "Dirty Dozen" Payloads
1. **Malicious Menu Creation**: Anonymous user tries to create a menu item. (Denied)
2. **Shadow Field Injection**: Admin tries to create a menu item with an extraneous `isSuperAdmin` field. (Denied by strict key matching)
3. **Menu Value Poisoning**: Admin tries to update menu item price to a string. (Denied by type check)
4. **Order ID Poisoning**: Attacker passes a 1.5MB string as an order ID document. (Denied by `isValidId` and wildcard constraints)
5. **Anonymous Order Update**: Anonymous user tries to update the status of an existing order to 'finalizado'. (Denied, only admin can update)
6. **Order Ghost Field**: Customer injects `{ status: "pagamento_aprovado", spoofed: true }` in order creation. (Denied by schema size/keys)
7. **Negative Order Total**: Customer creates an order with a total price < 0. (Denied by boundary check)
8. **Spoofed Admin Role**: User creates a user record claiming `role: 'admin'`. (No users collection handles roles, uses explicit `admins` collection)
9. **Admin Collection Tampering**: Admin tries to add another user to `admins`. (Denied: Admins collection cannot be written from client natively without a more complex rule, currently let's make it immutable via client)
10. **Unauthenticated Order Read**: Unauthenticated user tries to query all orders. (Denied)
11. **Spoofing CreatedAt Timestamp**: Customer creates an order with `createdAt` set to yesterday. (Denied by `request.time` enforcement)
12. **Array Overload**: Customer attempts to submit an order with 200 items. (Denied by `.size() <= 30` constraint)

## Test Runner
Defined in `firestore.rules.test.ts`.
