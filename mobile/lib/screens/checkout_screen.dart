import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../models.dart';
import '../state.dart';
import '../services/notifications.dart';
import 'account_screen.dart';
import 'order_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _form = GlobalKey<FormState>();
  final _c = <String, TextEditingController>{
    for (final k in ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode']) k: TextEditingController(),
  };
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _placeOrder() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    final cart = context.read<CartModel>();
    try {
      final address = {
        'name': _c['name']!.text,
        'phone': _c['phone']!.text,
        'line1': _c['line1']!.text,
        if (_c['line2']!.text.isNotEmpty) 'line2': _c['line2']!.text,
        'city': _c['city']!.text,
        'state': _c['state']!.text,
        'pincode': _c['pincode']!.text,
      };
      final res = await ApiClient.instance.checkout(cart.lines, address);
      final orderMap = res['order'] as Map<String, dynamic>;
      final payment = res['payment'] as Map<String, dynamic>;
      final orderId = orderMap['id'] as String;
      final orderNumber = orderMap['orderNumber'] as String;

      if (payment['provider'] == 'MOCK') {
        await ApiClient.instance.confirmMockPayment(orderId);
      } else {
        // Razorpay on mobile needs the razorpay_flutter plugin (documented in README).
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Online payment on mobile needs razorpay_flutter. Set PAYMENT_MODE=mock to test.')));
        setState(() => _busy = false);
        return;
      }

      await NotificationService.instance.orderPlaced(orderNumber);
      cart.clear();
      if (!mounted) return;
      Navigator.pushReplacement(
          context, MaterialPageRoute(builder: (_) => OrderScreen(orderNumber: orderNumber, justPlaced: true)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      setState(() => _busy = false);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Checkout failed. Is the backend running?')));
      }
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthModel>();
    final cart = context.watch<CartModel>();

    if (!auth.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Checkout')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Sign in to continue', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w400)),
                const SizedBox(height: 8),
                Text('You need an account to place an order and track it.',
                    textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.secondary)),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AccountScreen())),
                  child: const Text('SIGN IN'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    const freeShip = 149900;
    final shipping = cart.subtotalMinor >= freeShip ? 0 : 9900;
    final total = cart.subtotalMinor + shipping;

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Shipping address', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
            const SizedBox(height: 12),
            _field('name', 'Full name'),
            _field('phone', 'Phone', keyboard: TextInputType.phone),
            _field('line1', 'Address line 1'),
            _field('line2', 'Address line 2 (optional)', required: false),
            _field('city', 'City'),
            _field('state', 'State'),
            _field('pincode', 'PIN code', keyboard: TextInputType.number, pincode: true),
            const SizedBox(height: 20),
            _row('Subtotal', formatMoney(cart.subtotalMinor, cart.currency)),
            _row('Shipping', shipping == 0 ? 'Free' : formatMoney(shipping, cart.currency)),
            _row('Total', formatMoney(total, cart.currency), bold: true),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _busy ? null : _placeOrder,
                child: Text(_busy ? 'PROCESSING…' : 'PLACE ORDER · ${formatMoney(total, cart.currency)}'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String key, String label, {bool required = true, TextInputType? keyboard, bool pincode = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: _c[key],
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label),
        validator: (v) {
          if (required && (v == null || v.trim().isEmpty)) return 'Required';
          if (pincode && v != null && v.isNotEmpty && !RegExp(r'^\d{6}$').hasMatch(v)) return 'Enter a 6-digit PIN';
          return null;
        },
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.w400)),
            Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.w400)),
          ],
        ),
      );
}
