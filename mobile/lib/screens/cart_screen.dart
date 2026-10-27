import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../state.dart';
import 'checkout_screen.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();
    return Scaffold(
      appBar: AppBar(title: const Text('Your bag')),
      body: cart.isEmpty
          ? _empty(context)
          : Column(
              children: [
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: cart.lines.length,
                    separatorBuilder: (_, __) => const Divider(height: 24),
                    itemBuilder: (context, i) {
                      final l = cart.lines[i];
                      return Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(l.productTitle, style: const TextStyle(fontWeight: FontWeight.w500)),
                                const SizedBox(height: 2),
                                Text(l.variantName,
                                    style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.secondary)),
                                const SizedBox(height: 6),
                                Text(formatMoney(l.priceMinor * l.quantity, l.currency),
                                    style: const TextStyle(fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ),
                          _QtyStepper(
                            quantity: l.quantity,
                            onChanged: (q) => context.read<CartModel>().setQuantity(l.variantId, q),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                _summary(context, cart),
              ],
            ),
    );
  }

  Widget _empty(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Nothing here yet.', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w300)),
            const SizedBox(height: 8),
            Text('Pieces you add will wait for you here.',
                style: TextStyle(color: Theme.of(context).colorScheme.secondary)),
          ],
        ),
      );

  Widget _summary(BuildContext context, CartModel cart) {
    const freeShip = 149900;
    final shipping = cart.subtotalMinor >= freeShip ? 0 : 9900;
    final total = cart.subtotalMinor + shipping;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            _row(context, 'Subtotal', formatMoney(cart.subtotalMinor, cart.currency)),
            _row(context, 'Shipping', shipping == 0 ? 'Free' : formatMoney(shipping, cart.currency)),
            const SizedBox(height: 4),
            _row(context, 'Total', formatMoney(total, cart.currency), bold: true),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () =>
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const CheckoutScreen())),
                child: const Text('CHECKOUT'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.w400, fontSize: bold ? 16 : 14)),
            Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.w400, fontSize: bold ? 16 : 14)),
          ],
        ),
      );
}

class _QtyStepper extends StatelessWidget {
  final int quantity;
  final ValueChanged<int> onChanged;
  const _QtyStepper({required this.quantity, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(onPressed: () => onChanged(quantity - 1), icon: const Icon(Icons.remove, size: 18)),
        Text('$quantity', style: const TextStyle(fontWeight: FontWeight.w500)),
        IconButton(onPressed: () => onChanged(quantity + 1), icon: const Icon(Icons.add, size: 18)),
      ],
    );
  }
}
