import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'models.dart';

/// Shopping bag — persisted per device in SharedPreferences.
class CartModel extends ChangeNotifier {
  static const _key = 'aloravie_cart_v1';
  final List<CartLine> _lines = [];

  List<CartLine> get lines => List.unmodifiable(_lines);
  int get count => _lines.fold(0, (n, l) => n + l.quantity);
  int get subtotalMinor => _lines.fold(0, (n, l) => n + l.priceMinor * l.quantity);
  String get currency => _lines.isEmpty ? 'INR' : _lines.first.currency;
  bool get isEmpty => _lines.isEmpty;

  Future<void> load() async {
    try {
      final p = await SharedPreferences.getInstance();
      final raw = p.getString(_key);
      if (raw != null) {
        final list = jsonDecode(raw) as List;
        _lines
          ..clear()
          ..addAll(list.map((e) => CartLine.fromJson(e as Map<String, dynamic>)));
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> _persist() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_key, jsonEncode(_lines.map((l) => l.toJson()).toList()));
    } catch (_) {}
  }

  void add(CartLine line) {
    final existing = _lines.where((l) => l.variantId == line.variantId).toList();
    if (existing.isNotEmpty) {
      existing.first.quantity += line.quantity;
    } else {
      _lines.add(line);
    }
    notifyListeners();
    _persist();
  }

  void setQuantity(String variantId, int qty) {
    if (qty <= 0) {
      _lines.removeWhere((l) => l.variantId == variantId);
    } else {
      for (final l in _lines) {
        if (l.variantId == variantId) l.quantity = qty;
      }
    }
    notifyListeners();
    _persist();
  }

  void remove(String variantId) => setQuantity(variantId, 0);

  void clear() {
    _lines.clear();
    notifyListeners();
    _persist();
  }
}

/// Customer authentication state.
class AuthModel extends ChangeNotifier {
  CustomerAccount? _customer;
  bool _loading = true;

  CustomerAccount? get customer => _customer;
  bool get loading => _loading;
  bool get isSignedIn => _customer != null;

  Future<void> init() async {
    await ApiClient.instance.loadTokens();
    _customer = await ApiClient.instance.me();
    _loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    _customer = await ApiClient.instance.login(email, password);
    notifyListeners();
  }

  Future<void> register(String name, String email, String password, {String? phone}) async {
    _customer = await ApiClient.instance.register(name, email, password, phone: phone);
    notifyListeners();
  }

  Future<void> logout() async {
    await ApiClient.instance.logout();
    _customer = null;
    notifyListeners();
  }
}
