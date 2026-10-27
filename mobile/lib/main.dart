import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'state.dart';
import 'theme.dart';
import 'services/notifications.dart';
import 'screens/shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final cart = CartModel();
  final auth = AuthModel();
  await cart.load();
  await auth.init();
  await NotificationService.instance.init();

  runApp(AloravieApp(cart: cart, auth: auth));
}

class AloravieApp extends StatelessWidget {
  final CartModel cart;
  final AuthModel auth;
  const AloravieApp({super.key, required this.cart, required this.auth});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: cart),
        ChangeNotifierProvider.value(value: auth),
      ],
      child: MaterialApp(
        title: 'Aloravie',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: ThemeMode.system,
        home: const Shell(),
      ),
    );
  }
}
