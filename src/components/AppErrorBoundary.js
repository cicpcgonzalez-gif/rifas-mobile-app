import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { palette } from '../theme';
import { FilledButton, OutlineButton } from './UI';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error);
    if (info?.componentStack) {
      console.error(info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) this.props.onReset();
  };

  handleLogout = async () => {
    try {
      if (this.props.onLogout) await this.props.onLogout();
    } finally {
      this.handleReset();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background, padding: 16, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
            Ocurrió un error inesperado
          </Text>
          <Text style={{ color: palette.subtext, marginTop: 10, textAlign: 'center' }}>
            Puedes reintentar. Si estabas autenticado, también puedes cerrar sesión.
          </Text>

          <View style={{ width: '100%', marginTop: 16 }}>
            <FilledButton title="Reintentar" onPress={this.handleReset} />
            {this.props.onLogout ? (
              <OutlineButton title="Cerrar sesión" onPress={this.handleLogout} style={{ marginTop: 10 }} />
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }
}
