import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'models.dart';

/// The Aloravie wordmark in Jost. (Production uses the supplied logo files;
/// this styled text is a stand-in with the brand's terracotta and weight.)
class Wordmark extends StatelessWidget {
  final double size;
  final Color? color;
  const Wordmark({super.key, this.size = 22, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Text(
      'aloravie',
      style: GoogleFonts.jost(fontSize: size, fontWeight: FontWeight.w500, color: c, letterSpacing: -0.5),
    );
  }
}

/// A deterministic on-brand gradient for a product with no image yet.
LinearGradient toneForSlug(String slug) {
  const palettes = [
    [Color(0xFFF1E4D2), Color(0xFFCF8A63)],
    [Color(0xFFEFE6D8), Color(0xFFD3A07E)],
    [Color(0xFFE7D6C0), Color(0xFFB9754F)],
    [Color(0xFFF0E7D7), Color(0xFFC79A76)],
    [Color(0xFFE4D3BB), Color(0xFF9C6749)],
    [Color(0xFFEFE4D2), Color(0xFFC28A66)],
  ];
  var hash = 0;
  for (final code in slug.codeUnits) {
    hash = (hash * 31 + code) & 0x7fffffff;
  }
  final pair = palettes[hash % palettes.length];
  return LinearGradient(colors: pair, begin: Alignment.topLeft, end: Alignment.bottomRight);
}

class ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;
  const ProductCard({super.key, required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 4 / 5,
              child: DecoratedBox(decoration: BoxDecoration(gradient: toneForSlug(product.slug))),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w400, fontSize: 14)),
                  if (product.category != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(product.category!.name,
                          style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.secondary)),
                    ),
                  const SizedBox(height: 6),
                  Text(formatMoney(product.minPriceMinor, product.currency),
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A small uppercase status chip.
class StatusPill extends StatelessWidget {
  final String label;
  final Color? color;
  const StatusPill(this.label, {super.key, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.secondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: c.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.withOpacity(0.4)),
      ),
      child: Text(label.toUpperCase(),
          style: TextStyle(fontSize: 10, letterSpacing: 0.6, color: c, fontWeight: FontWeight.w500)),
    );
  }
}
