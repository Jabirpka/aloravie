import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  final int status;
  final String code;
  final String message;
  ApiException(this.status, this.code, this.message);
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _accessKey = 'aloravie_access';
  static const _refreshKey = 'aloravie_refresh';

  String? _access;
  String? _refresh;

  Future<void> loadTokens() async {
    final p = await SharedPreferences.getInstance();
    _access = p.getString(_accessKey);
    _refresh = p.getString(_refreshKey);
  }

  Future<void> _setTokens(String access, String refresh) async {
    _access = access;
    _refresh = refresh;
    final p = await SharedPreferences.getInstance();
    await p.setString(_accessKey, access);
    await p.setString(_refreshKey, refresh);
  }

  Future<void> clearTokens() async {
    _access = null;
    _refresh = null;
    final p = await SharedPreferences.getInstance();
    await p.remove(_accessKey);
    await p.remove(_refreshKey);
  }

  bool get isSignedIn => _access != null;

  Uri _uri(String path) => Uri.parse('${Config.apiUrl}$path');

  Future<dynamic> _send(String method, String path, {Object? body, bool auth = false, bool retry = true}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth && _access != null) headers['Authorization'] = 'Bearer $_access';

    final req = http.Request(method, _uri(path))..headers.addAll(headers);
    if (body != null) req.body = jsonEncode(body);
    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);

    if (res.statusCode == 401 && auth && retry && _refresh != null) {
      if (await _tryRefresh()) {
        return _send(method, path, body: body, auth: auth, retry: false);
      }
    }

    final text = res.body;
    final data = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    if (res.statusCode >= 400) {
      final err = (data is Map && data['error'] is Map) ? data['error'] as Map : const {};
      throw ApiException(res.statusCode, (err['code'] as String?) ?? 'ERROR', (err['message'] as String?) ?? 'Request failed');
    }
    return data;
  }

  Future<bool> _tryRefresh() async {
    try {
      final res = await http.post(_uri('/api/customers/refresh'),
          headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': _refresh}));
      if (res.statusCode >= 400) {
        await clearTokens();
        return false;
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      await _setTokens(data['accessToken'] as String, data['refreshToken'] as String);
      return true;
    } catch (_) {
      return false;
    }
  }

  // --- Catalog (public) ---

  Future<List<Product>> products() async {
    try {
      final data = await _send('GET', '/api/products?status=ACTIVE');
      final list = (data['products'] as List?) ?? [];
      if (list.isEmpty) return _sampleProducts;
      return list.map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
    } catch (_) {
      return _sampleProducts; // offline / backend down → sample catalogue
    }
  }

  Future<Product?> product(String slug) async {
    try {
      final data = await _send('GET', '/api/products/$slug');
      return Product.fromJson(data['product'] as Map<String, dynamic>);
    } catch (_) {
      for (final p in _sampleProducts) {
        if (p.slug == slug) return p;
      }
      return null;
    }
  }

  // --- Auth ---

  Future<CustomerAccount> register(String name, String email, String password, {String? phone}) async {
    final data = await _send('POST', '/api/customers/register',
        body: {'name': name, 'email': email, 'password': password, if (phone != null) 'phone': phone});
    await _setTokens(data['accessToken'] as String, data['refreshToken'] as String);
    return CustomerAccount.fromJson(data['customer'] as Map<String, dynamic>);
  }

  Future<CustomerAccount> login(String email, String password) async {
    final data = await _send('POST', '/api/customers/login', body: {'email': email, 'password': password});
    await _setTokens(data['accessToken'] as String, data['refreshToken'] as String);
    return CustomerAccount.fromJson(data['customer'] as Map<String, dynamic>);
  }

  Future<CustomerAccount?> me() async {
    if (!isSignedIn) return null;
    try {
      final data = await _send('GET', '/api/customers/me', auth: true);
      return data['customer'] == null ? null : CustomerAccount.fromJson(data['customer'] as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> logout() async {
    if (_refresh != null) {
      try {
        await _send('POST', '/api/customers/logout', body: {'refreshToken': _refresh});
      } catch (_) {}
    }
    await clearTokens();
  }

  // --- Checkout & orders ---

  Future<Map<String, dynamic>> checkout(List<CartLine> lines, Map<String, String> shippingAddress, {String? email}) async {
    final items = lines.map((l) => {'variantId': l.variantId, 'quantity': l.quantity}).toList();
    final data = await _send('POST', '/api/checkout',
        auth: true, body: {'items': items, 'shippingAddress': shippingAddress, if (email != null) 'email': email});
    return data as Map<String, dynamic>;
  }

  Future<Order> confirmMockPayment(String orderId) async {
    final data = await _send('POST', '/api/payments/mock/confirm', auth: true, body: {'orderId': orderId});
    return Order.fromJson(data['order'] as Map<String, dynamic>);
  }

  Future<List<Order>> orders() async {
    final data = await _send('GET', '/api/orders', auth: true);
    return ((data['orders'] as List?) ?? []).map((o) => Order.fromJson(o as Map<String, dynamic>)).toList();
  }

  Future<Order> order(String orderNumber) async {
    final data = await _send('GET', '/api/orders/$orderNumber', auth: true);
    return Order.fromJson(data['order'] as Map<String, dynamic>);
  }
}

// A tiny sample catalogue so the app renders before the backend is reachable.
final List<Product> _sampleProducts = [
  Product(
    id: 'p-aurora', title: 'Aurora Cotton Kurta', slug: 'aurora-cotton-kurta',
    description: 'A hand block-print cotton kurta in terracotta, cut easy for slow mornings.',
    category: Category(id: 'c-kurtas', name: 'Kurtas', slug: 'kurtas'),
    variants: [
      Variant(id: 'v-aurora-s', sku: 'ALV-AURORA-S', name: 'S / Terracotta', priceMinor: 189000, currency: 'INR'),
      Variant(id: 'v-aurora-m', sku: 'ALV-AURORA-M', name: 'M / Terracotta', priceMinor: 189000, currency: 'INR'),
    ],
  ),
  Product(
    id: 'p-firstlight', title: 'First Light Linen Dress', slug: 'first-light-linen-dress',
    description: 'A sand-toned linen midi dress for warm days and first light.',
    category: Category(id: 'c-dresses', name: 'Dresses', slug: 'dresses'),
    variants: [Variant(id: 'v-fl-m', sku: 'ALV-FLLD-M', name: 'M / Sand', priceMinor: 275000, currency: 'INR')],
  ),
  Product(
    id: 'p-saree', title: 'Sand Handloom Saree', slug: 'sand-handloom-saree',
    description: 'Pure cotton handloom saree in sand with a cocoa border.',
    category: Category(id: 'c-sarees', name: 'Sarees', slug: 'sarees'),
    variants: [Variant(id: 'v-saree', sku: 'ALV-SAREE-SAND', name: '5.5 m / Sand', priceMinor: 349000, currency: 'INR')],
  ),
  Product(
    id: 'p-tote', title: 'Morning Canvas Tote', slug: 'morning-canvas-tote',
    description: 'A sturdy clay canvas tote for everyday carry.',
    category: Category(id: 'c-acc', name: 'Accessories', slug: 'accessories'),
    variants: [Variant(id: 'v-tote', sku: 'ALV-TOTE-CLAY', name: 'One size / Clay', priceMinor: 115000, currency: 'INR')],
  ),
];
