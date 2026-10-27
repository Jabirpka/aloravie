import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../state.dart';
import '../widgets.dart';
import 'orders_screen.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _form = GlobalKey<FormState>();
  bool _register = false;
  bool _busy = false;
  String? _error;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthModel>();
    try {
      if (_register) {
        await auth.register(_name.text, _email.text, _password.text,
            phone: _phone.text.isEmpty ? null : _phone.text);
      } else {
        await auth.login(_email.text, _password.text);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Something went wrong. Is the backend running?');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthModel>();

    if (auth.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (auth.isSignedIn) {
      final c = auth.customer!;
      return Scaffold(
        appBar: AppBar(title: const Text('Account')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hello${c.name != null ? ', ${c.name!.split(' ').first}' : ''}.',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w300)),
            const SizedBox(height: 16),
            if (c.email != null) ListTile(leading: const Icon(Icons.email_outlined), title: Text(c.email!)),
            if (c.phone != null) ListTile(leading: const Icon(Icons.phone_outlined), title: Text(c.phone!)),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OrdersScreen())),
              child: const Text('MY ORDERS'),
            ),
            const SizedBox(height: 10),
            OutlinedButton(onPressed: () => auth.logout(), child: const Text('SIGN OUT')),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Wordmark()),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Sign in')),
              ButtonSegment(value: true, label: Text('Create account')),
            ],
            selected: {_register},
            onSelectionChanged: (s) => setState(() => _register = s.first),
          ),
          const SizedBox(height: 20),
          Form(
            key: _form,
            child: Column(
              children: [
                if (_register)
                  _field(_name, 'Name', validator: (v) => (v == null || v.isEmpty) ? 'Required' : null),
                _field(_email, 'Email',
                    keyboard: TextInputType.emailAddress,
                    validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email' : null),
                if (_register) _field(_phone, 'Phone (optional)', keyboard: TextInputType.phone, validator: (_) => null),
                _field(_password, 'Password',
                    obscure: true,
                    validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? 'PLEASE WAIT…' : (_register ? 'CREATE ACCOUNT' : 'SIGN IN')),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {bool obscure = false, TextInputType? keyboard, String? Function(String?)? validator}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: c,
        obscureText: obscure,
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label),
        validator: validator,
      ),
    );
  }
}
