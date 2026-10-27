import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import 'product_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Product>> _future;

  @override
  void initState() {
    super.initState();
    _future = ApiClient.instance.products();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Wordmark()),
      body: FutureBuilder<List<Product>>(
        future: _future,
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final products = snap.data!;
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _hero(context)),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: Text('New in this week',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w400)),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2, mainAxisSpacing: 16, crossAxisSpacing: 14, childAspectRatio: 0.62),
                  delegate: SliverChildBuilderDelegate(
                    (context, i) => ProductCard(
                      product: products[i],
                      onTap: () => Navigator.push(context,
                          MaterialPageRoute(builder: (_) => ProductScreen(slug: products[i].slug, initial: products[i]))),
                    ),
                    childCount: products.length,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _hero(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        gradient: const LinearGradient(
          colors: [Brand.sand, Color(0xFFD7A985), Brand.terracotta],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('NEW COLLECTION · AUTUMN ’26',
              style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11, letterSpacing: 2)),
          const SizedBox(height: 12),
          const Text('Made for slow mornings and first light.',
              style: TextStyle(color: Colors.white, fontSize: 26, height: 1.1, fontWeight: FontWeight.w300)),
          const SizedBox(height: 10),
          Text('DRESSED UP IN FIRST LIGHT',
              style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11, letterSpacing: 3)),
        ],
      ),
    );
  }
}
