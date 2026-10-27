import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Aloravie brand palette (mirrors shared/brand/tokens).
class Brand {
  static const terracotta = Color(0xFFC8714F);
  static const cream = Color(0xFFFFF8F0);
  static const cocoa = Color(0xFF3A2620);
  static const sand = Color(0xFFE9DCCB);
  static const clay = Color(0xFF8A5A44);

  // Evening (dark) accents
  static const terracottaDark = Color(0xFFD98363);
  static const surfaceDark = Color(0xFF43302A);
}

ThemeData buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: isDark ? Brand.terracottaDark : Brand.terracotta,
    onPrimary: isDark ? const Color(0xFF2A1A15) : Brand.cream,
    secondary: Brand.clay,
    onSecondary: Brand.cream,
    surface: isDark ? Brand.surfaceDark : const Color(0xFFFFFCF8),
    onSurface: isDark ? Brand.cream : Brand.cocoa,
    error: const Color(0xFFB23B2E),
    onError: Colors.white,
  );

  final bg = isDark ? Brand.cocoa : Brand.cream;
  final base = isDark ? ThemeData.dark() : ThemeData.light();

  return base.copyWith(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    canvasColor: bg,
    textTheme: GoogleFonts.jostTextTheme(base.textTheme).apply(
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.jost(
        fontSize: 22,
        fontWeight: FontWeight.w500,
        color: scheme.primary,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
        textStyle: GoogleFonts.jost(fontSize: 14, fontWeight: FontWeight.w400, letterSpacing: 0.6),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: bg,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: isDark ? const Color(0xFF513A31) : const Color(0xFFE4D6C4)),
      ),
    ),
  );
}
