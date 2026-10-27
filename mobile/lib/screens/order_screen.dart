import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../widgets.dart';

class OrderScreen extends StatefulWidget {
  final String orderNumber;
  final bool justPlaced;
  const OrderScreen({super.key, required this.orderNumber, this.justPlaced = false});
  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends State<OrderScreen> {
  late Future<Order> _future;

  @override
  void initState() {
    super.initState();
    _future = ApiClient.instance.order(widget.orderNumber);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.orderNumber)),
      body: FutureBuilder<Order>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Order not found.')));
          }
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final o = snap.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (widget.justPlaced) ...[
                Text('Thank you', style: TextStyle(color: Theme.of(context).colorScheme.secondary, letterSpacing: 2)),
                const Text('Your order is confirmed.',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w300)),
                const SizedBox(height: 12),
              ],
              Row(children: [StatusPill(o.status)]),
              const SizedBox(height: 16),
              if (o.shipment != null) _tracking(context, o.shipment!),
              _items(context, o),
              const Divider(height: 28),
              _row(context, 'Subtotal', formatMoney(o.subtotalMinor, o.currency)),
              _row(context, 'GST', formatMoney(o.taxMinor, o.currency)),
              _row(context, 'Shipping', o.shippingMinor == 0 ? 'Free' : formatMoney(o.shippingMinor, o.currency)),
              _row(context, 'Total', formatMoney(o.totalMinor, o.currency), bold: true),
            ],
          );
        },
      ),
    );
  }

  Widget _tracking(BuildContext context, Shipment s) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(s.courierName, style: const TextStyle(fontWeight: FontWeight.w500)),
                if (s.awb != null)
                  Text('AWB ${s.awb}', style: TextStyle(color: Theme.of(context).colorScheme.secondary, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 12),
            if (s.events.isEmpty)
              Text('Your parcel is being prepared.', style: TextStyle(color: Theme.of(context).colorScheme.secondary))
            else
              for (int i = 0; i < s.events.length; i++) _event(context, s.events[i], i == s.events.length - 1),
          ],
        ),
      ),
    );
  }

  Widget _event(BuildContext context, TrackingEvent e, bool current) {
    final accent = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4, right: 12),
            width: 10, height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: current ? accent : Theme.of(context).dividerColor,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(e.location == null ? e.status : '${e.status} · ${e.location}'),
                Text(_fmt(e.occurredAt),
                    style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.secondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _items(BuildContext context, Order o) => Column(
        children: [
          for (final it in o.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(it.titleSnapshot, style: const TextStyle(fontWeight: FontWeight.w500)),
                        Text('${it.skuSnapshot} · ×${it.quantity}',
                            style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.secondary)),
                      ],
                    ),
                  ),
                  Text(formatMoney(it.totalMinor, o.currency), style: const TextStyle(fontWeight: FontWeight.w500)),
                ],
              ),
            ),
        ],
      );

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

  String _fmt(DateTime d) {
    final l = d.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(l.day)}/${two(l.month)}/${l.year} ${two(l.hour)}:${two(l.minute)}';
  }
}
