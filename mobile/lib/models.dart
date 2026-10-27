/// Data models mirroring the Aloravie backend API responses.

String formatMoney(int amountMinor, [String currency = 'INR']) {
  final rupees = (amountMinor / 100).round();
  // Indian digit grouping: last 3 digits, then groups of 2.
  final s = rupees.abs().toString();
  final buf = StringBuffer();
  int count = 0;
  for (int i = s.length - 1; i >= 0; i--) {
    buf.write(s[i]);
    count++;
    final remaining = i;
    if (remaining > 0) {
      if (count == 3 || (count > 3 && (count - 3) % 2 == 0)) buf.write(',');
    }
  }
  final grouped = buf.toString().split('').reversed.join();
  final symbol = currency == 'INR' ? '₹' : '$currency ';
  return '$symbol$grouped';
}

class Category {
  final String id;
  final String name;
  final String slug;
  Category({required this.id, required this.name, required this.slug});
  factory Category.fromJson(Map<String, dynamic> j) =>
      Category(id: j['id'] as String, name: j['name'] as String, slug: j['slug'] as String);
}

class Variant {
  final String id;
  final String sku;
  final String name;
  final int priceMinor;
  final String currency;
  Variant({required this.id, required this.sku, required this.name, required this.priceMinor, required this.currency});
  factory Variant.fromJson(Map<String, dynamic> j) => Variant(
        id: j['id'] as String,
        sku: j['sku'] as String,
        name: j['name'] as String,
        priceMinor: j['priceMinor'] as int,
        currency: (j['currency'] as String?) ?? 'INR',
      );
}

class Product {
  final String id;
  final String title;
  final String slug;
  final String? description;
  final Category? category;
  final List<Variant> variants;
  Product({required this.id, required this.title, required this.slug, this.description, this.category, required this.variants});

  int get minPriceMinor =>
      variants.isEmpty ? 0 : variants.map((v) => v.priceMinor).reduce((a, b) => a < b ? a : b);
  String get currency => variants.isEmpty ? 'INR' : variants.first.currency;

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'] as String,
        title: j['title'] as String,
        slug: j['slug'] as String,
        description: j['description'] as String?,
        category: j['category'] == null ? null : Category.fromJson(j['category'] as Map<String, dynamic>),
        variants: ((j['variants'] as List?) ?? [])
            .map((v) => Variant.fromJson(v as Map<String, dynamic>))
            .toList(),
      );
}

class CartLine {
  final String variantId;
  final String productSlug;
  final String productTitle;
  final String variantName;
  final int priceMinor;
  final String currency;
  int quantity;
  CartLine({
    required this.variantId,
    required this.productSlug,
    required this.productTitle,
    required this.variantName,
    required this.priceMinor,
    required this.currency,
    this.quantity = 1,
  });

  Map<String, dynamic> toJson() => {
        'variantId': variantId,
        'productSlug': productSlug,
        'productTitle': productTitle,
        'variantName': variantName,
        'priceMinor': priceMinor,
        'currency': currency,
        'quantity': quantity,
      };
  factory CartLine.fromJson(Map<String, dynamic> j) => CartLine(
        variantId: j['variantId'] as String,
        productSlug: j['productSlug'] as String,
        productTitle: j['productTitle'] as String,
        variantName: j['variantName'] as String,
        priceMinor: j['priceMinor'] as int,
        currency: j['currency'] as String,
        quantity: j['quantity'] as int,
      );
}

class CustomerAccount {
  final String id;
  final String? email;
  final String? name;
  final String? phone;
  CustomerAccount({required this.id, this.email, this.name, this.phone});
  factory CustomerAccount.fromJson(Map<String, dynamic> j) => CustomerAccount(
        id: j['id'] as String,
        email: j['email'] as String?,
        name: j['name'] as String?,
        phone: j['phone'] as String?,
      );
}

class OrderItem {
  final String id;
  final String titleSnapshot;
  final String skuSnapshot;
  final int unitPriceMinor;
  final int quantity;
  final int totalMinor;
  OrderItem({required this.id, required this.titleSnapshot, required this.skuSnapshot, required this.unitPriceMinor, required this.quantity, required this.totalMinor});
  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['id'] as String,
        titleSnapshot: j['titleSnapshot'] as String,
        skuSnapshot: j['skuSnapshot'] as String,
        unitPriceMinor: j['unitPriceMinor'] as int,
        quantity: j['quantity'] as int,
        totalMinor: j['totalMinor'] as int,
      );
}

class TrackingEvent {
  final String id;
  final String status;
  final String? location;
  final DateTime occurredAt;
  TrackingEvent({required this.id, required this.status, this.location, required this.occurredAt});
  factory TrackingEvent.fromJson(Map<String, dynamic> j) => TrackingEvent(
        id: j['id'] as String,
        status: j['status'] as String,
        location: j['location'] as String?,
        occurredAt: DateTime.parse(j['occurredAt'] as String),
      );
}

class Shipment {
  final String courierName;
  final String? awb;
  final String status;
  final List<TrackingEvent> events;
  Shipment({required this.courierName, this.awb, required this.status, required this.events});
  factory Shipment.fromJson(Map<String, dynamic> j) => Shipment(
        courierName: j['courierName'] as String,
        awb: j['awb'] as String?,
        status: j['status'] as String,
        events: ((j['events'] as List?) ?? [])
            .map((e) => TrackingEvent.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class Order {
  final String id;
  final String orderNumber;
  final String status;
  final String currency;
  final int subtotalMinor;
  final int shippingMinor;
  final int taxMinor;
  final int totalMinor;
  final DateTime placedAt;
  final List<OrderItem> items;
  final Shipment? shipment;
  Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.currency,
    required this.subtotalMinor,
    required this.shippingMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.placedAt,
    required this.items,
    this.shipment,
  });
  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'] as String,
        orderNumber: j['orderNumber'] as String,
        status: j['status'] as String,
        currency: (j['currency'] as String?) ?? 'INR',
        subtotalMinor: (j['subtotalMinor'] as int?) ?? 0,
        shippingMinor: (j['shippingMinor'] as int?) ?? 0,
        taxMinor: (j['taxMinor'] as int?) ?? 0,
        totalMinor: (j['totalMinor'] as int?) ?? 0,
        placedAt: DateTime.parse(j['placedAt'] as String),
        items: ((j['items'] as List?) ?? [])
            .map((i) => OrderItem.fromJson(i as Map<String, dynamic>))
            .toList(),
        shipment: j['shipment'] == null ? null : Shipment.fromJson(j['shipment'] as Map<String, dynamic>),
      );
}
