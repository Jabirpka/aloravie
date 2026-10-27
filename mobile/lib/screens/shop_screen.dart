import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../widgets.dart';
import 'product_screen.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});
  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  late Future<List<Product>> _future;
  String _category = '';

  static const _categories = [
    ['', 'All'], ['kurtas', 'Kurtas'], ['dresses', 'Dresses'], ['sarees', 'Sarees'], ['accessories', 'Accessories'],
  ];

  @override
  void initState() {
    super.initState();
    _future = ApiClient.instance.products();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shop')),
      body: FutureBuilder<List<Product>>(
        future: _future,
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final all = snap.data!;
          final products = _category.isEmpty
              ? all
              : all.where((p) => p.category?.slug == _category).toList();
          return Column(
            children: [
              SizedBox(
                height: 54,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  children: [
                    for (final c in _categories)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: ChoiceChip(
                          label: Text(c[1]),
                          selected: _category == c[0],
                          onSelected: (_) => setState(() => _category = c[0]),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: products.isEmpty
                    ? const Center(child: Text('No pieces in this category yet.'))
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2, mainAxisSpacing: 16, crossAxisSpacing: 14, childAspectRatio: 0.62),
                        itemCount: products.length,
                        itemBuilder: (context, i) => ProductCard(
                          product: products[i],
                          onTap: () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => ProductScreen(slug: products[i].slug, initial: products[i]))),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
