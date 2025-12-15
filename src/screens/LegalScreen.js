import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';

const LegalScreen = ({ navigation }) => {
  const sections = [
    {
      title: 'Términos y Condiciones',
      content: `
1. Aceptación de los Términos
Al descargar, acceder o utilizar la aplicación MegaRifas, usted acepta estar sujeto a estos términos y condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá utilizar nuestros servicios.

2. Elegibilidad
El servicio está disponible solo para personas mayores de 18 años. Al registrarse, usted declara y garantiza que tiene la edad legal para participar en sorteos según la legislación de su jurisdicción.

3. Rol de MegaRifas
MegaRifas es una herramienta tecnológica para que organizadores independientes gestionen sus rifas. Los organizadores son los únicos responsables legales y operativos de cada sorteo, la entrega de premios y la comunicación con los participantes. MegaRifas no organiza, administra ni se hace responsable por la ejecución de los sorteos.

3. Reglas de los Sorteos
- Cada rifa tiene sus propias reglas específicas, fecha de sorteo y premios detallados en la descripción.
- Los tickets son digitales y se generan con una firma criptográfica única para garantizar su autenticidad.
- Los ganadores serán notificados a través de la aplicación y por correo electrónico.
- Es responsabilidad del usuario mantener sus datos de contacto actualizados.

4. Pagos y Reembolsos
- Los pagos se procesan a través de pasarelas seguras.
- Una vez adquirido un ticket, no se admiten devoluciones salvo en caso de cancelación del sorteo por parte de la administración.
- MegaRifas se reserva el derecho de cancelar transacciones sospechosas de fraude.

5. Propiedad Intelectual
Todo el contenido, marcas y logotipos mostrados en la aplicación son propiedad de MegaRifas o sus licenciantes.

6. Modificaciones
Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en la aplicación.
      `
    },
    {
      title: 'Responsabilidad de los Organizadores',
      content: `
1. Responsabilidad exclusiva
Cada organizador es responsable de la legalidad del sorteo, de los permisos o licencias requeridas, de la veracidad de la información publicada y de entregar los premios ofrecidos.

2. Manejo de fondos y premios
Los pagos, transferencias y entrega de premios son gestionados directamente por el organizador. MegaRifas no recibe, custodia ni distribuye fondos o premios en nombre de los organizadores.

3. Reclamaciones
Cualquier duda o reclamación sobre un sorteo debe dirigirse al organizador correspondiente. MegaRifas puede colaborar con información técnica del sorteo, pero no asume responsabilidad por daños, pérdidas o incumplimientos.
      `
    },
    {
      title: 'Política de Privacidad',
      content: `
1. Recopilación de Datos
Recopilamos información personal que usted nos proporciona voluntariamente, como nombre, correo electrónico, número de teléfono y datos de pago. También recopilamos datos técnicos como dirección IP y tipo de dispositivo para fines de seguridad y mejora del servicio.

2. Uso de la Información
Utilizamos sus datos para:
- Procesar sus compras de tickets.
- Verificar su identidad (KYC) para el cumplimiento legal.
- Notificarle sobre resultados de sorteos y promociones.
- Prevenir fraudes y mejorar la seguridad de la plataforma.

3. Protección de Datos
Implementamos medidas de seguridad robustas, incluyendo encriptación de datos sensibles y comunicaciones seguras (SSL/TLS). No compartimos su información personal con terceros, excepto cuando sea necesario para procesar pagos o cumplir con la ley.

4. Derechos del Usuario (ARCO)
Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales. Puede ejercer estos derechos contactando a nuestro soporte técnico.

5. Retención de Datos
Conservamos sus datos mientras su cuenta esté activa o sea necesario para cumplir con nuestras obligaciones legales.
      `
    },
    {
      title: 'Marco Legal y Protección al Consumidor',
      content: `
MegaRifas opera en cumplimiento con las leyes vigentes de protección al consumidor y regulaciones de juegos de suerte y azar.

1. Transparencia
Garantizamos la transparencia en todos nuestros sorteos mediante el uso de firmas criptográficas verificables y auditorías públicas.

2. Atención al Cliente
Disponemos de canales de atención para resolver dudas, quejas o reclamos de manera eficiente.

3. Juego Responsable
Promovemos el juego responsable y ofrecemos herramientas para que los usuarios puedan gestionar su participación. Si siente que el juego está afectando su vida, le recomendamos buscar ayuda profesional.

4. Legislación Aplicable
Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Cualquier disputa será resuelta en los tribunales competentes de dicha jurisdicción.
      `
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal y Privacidad</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Versión 1.0.0 - 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.card,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.primary,
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    color: palette.textSecondary,
    fontSize: 12,
  }
});

export default LegalScreen;
