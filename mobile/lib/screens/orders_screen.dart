import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../widgets.dart';
import 'order_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<Order>> _future;

  @override
  void initState() {
    super.initState();
    _future = ApiClient.instance.orders();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: FutureBuilder<List<Order>>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return const Center(child: Text('Couldn\'t load your orders.'));
          }
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final orders = snap.data!;
          if (orders.isEmpty) {
            return const Center(child: Text('No orders yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: orders.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final o = orders[i];
              return Card(
                child: ListTile(
                  title: Text(o.orderNumber, style: const TextStyle(fontWeight: FontWeight.w500)),
                  subtitle: Text('${_fmt(o.placedAt)} · ${o.items.length} item${o.items.length == 1 ? '' : 's'}'),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      StatusPill(o.status),
                      const SizedBox(height: 4),
                      Text(formatMoney(o.totalMinor, o.currency), style: const TextStyle(fontWeight: FontWeight.w500)),
                    ],
                  ),
                  onTap: () => Navigator.push(
                      context, MaterialPageRoute(builder: (_) => OrderScreen(orderNumber: o.orderNumber))),
                ),
              );
            },
          );
        },
      ),
    );
  }

  String _fmt(DateTime d) {
    final l = d.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(l.day)}/${two(l.month)}/${l.year}';
  }
}
