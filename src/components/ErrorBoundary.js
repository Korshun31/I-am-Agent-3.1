import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Ошибка загрузки</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'Произошла ошибка. Попробуйте перезапустить приложение.'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F5F2EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#5A5A5A',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#5DB87A',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
