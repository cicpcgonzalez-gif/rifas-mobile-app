import React from 'react';
import { SafeAreaView, View, Text, ScrollView } from 'react-native';
import { palette } from '../theme';
import { FilledButton, OutlineButton } from './UI';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error);
    if (info?.componentStack) {
      console.error(info.componentStack);
    }
    this.setState({ error, errorInfo: info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
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

    const errorMessage = this.state?.error?.message ? String(this.state.error.message) : String(this.state?.error || '');
    const errorStack = this.state?.error?.stack ? String(this.state.error.stack) : '';
    const componentStack = this.state?.errorInfo?.componentStack ? String(this.state.errorInfo.componentStack) : '';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background, padding: 16, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
            Ocurrió un error inesperado
          </Text>
          <Text style={{ color: palette.subtext, marginTop: 10, textAlign: 'center' }}>
            Puedes reintentar. Si estabas autenticado, también puedes cerrar sesión.
          </Text>

          {(errorMessage || errorStack || componentStack) ? (
            <ScrollView style={{ width: '100%', marginTop: 14, maxHeight: 220 }}>
              {!!errorMessage && (
                <Text selectable style={{ color: palette.muted, fontSize: 12, lineHeight: 16 }}>
                  Detalle: {errorMessage}
                </Text>
              )}
              {!!errorStack && (
                <Text selectable style={{ color: palette.muted, marginTop: 10, fontSize: 11, lineHeight: 14 }}>
                  Stack: {errorStack}
                </Text>
              )}
              {!!componentStack && (
                <Text selectable style={{ color: palette.muted, marginTop: 10, fontSize: 11, lineHeight: 14 }}>
                  {componentStack}
                </Text>
              )}
            </ScrollView>
          ) : null}

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
