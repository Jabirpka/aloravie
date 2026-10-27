import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../models.dart';
import '../state.dart';
import '../widgets.dart';

class ProductScreen extends StatefulWidget {
  final String slug;
  final Product? initial;
  const ProductScreen({super.key, required this.slug, this.initial});
  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  Product? _product;
  Variant? _variant;

  @override
  void initState() {
    super.initState();
    _product = widget.initial;
    _variant = widget.initial?.variants.isNotEmpty == true ? widget.initial!.variants.first : null;
    ApiClient.instance.product(widget.slug).then((p) {
      if (p != null && mounted) {
        setState(() {
          _product = p;
          _variant = p.variants.isNotEmpty ? p.variants.first : null;
        });
      }
    });
  }

  void _addToBag() {
    final p = _product, v = _variant;
    if (p == null || v == null) return;
    context.read<CartModel>().add(CartLine(
          variantId: v.id,
          productSlug: p.slug,
          productTitle: p.title,
          variantName: v.name,
          priceMinor: v.priceMinor,
          currency: v.currency,
        ));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${p.title} added to your bag'), duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = _product;
    if (p == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final v = _variant;
    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        children: [
          AspectRatio(
            aspectRatio: 4 / 5,
            child: DecoratedBox(decoration: BoxDecoration(gradient: toneForSlug(p.slug))),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (p.category != null)
                  Text(p.category!.name.toUpperCase(),
                      style: TextStyle(fontSize: 11, letterSpacing: 2, color: Theme.of(context).colorScheme.secondary)),
                const SizedBox(height: 6),
                Text(p.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w400)),
                const SizedBox(height: 10),
                if (v != null)
                  Text(formatMoney(v.priceMinor, v.currency),
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w500)),
                const SizedBox(height: 16),
                if (p.description != null) Text(p.description!, style: const TextStyle(height: 1.5)),
                const SizedBox(height: 20),
                if (p.variants.length > 1) ...[
                  const Text('Size', style: TextStyle(fontSize: 13)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final variant in p.variants)
                        ChoiceChip(
                          label: Text(variant.name),
                          selected: _variant?.id == variant.id,
                          onSelected: (_) => setState(() => _variant = variant),
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),
                ],
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: v == null ? null : _addToBag,
                    child: const Text('ADD TO BAG'),
                  ),
                ),
                const SizedBox(height: 16),
                const _Perks(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Perks extends StatelessWidget {
  const _Perks();
  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.secondary);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(),
        const SizedBox(height: 8),
        Text('Free shipping on orders over ₹1,499', style: style),
        Text('7-day easy returns', style: style),
        Text('Made in India', style: style),
      ],
    );
  }
}
