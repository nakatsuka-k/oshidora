import { registerRootComponent } from 'expo'
import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import App from './App'

class RootErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ error: unknown; errorInfo?: React.ErrorInfo | null }
> {
	state: { error: unknown; errorInfo?: React.ErrorInfo | null } = { error: null, errorInfo: null }

	static getDerivedStateFromError(error: unknown) {
		return { error }
	}

	componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
		// eslint-disable-next-line no-console
		console.error('[admin] uncaught render error', error, errorInfo)
		this.setState({ error, errorInfo })
	}

	render() {
		if (!this.state.error) return this.props.children

		const message = this.state.error instanceof Error ? this.state.error.message : String(this.state.error)

		return React.createElement(
			View,
			{ style: styles.root },
			React.createElement(Text, { style: styles.title }, '画面の表示に失敗しました'),
			React.createElement(
				Text,
				{ style: styles.desc },
				'お手数ですが、再読み込みしてください。改善しない場合はコンソールのエラーを共有してください。'
			),
			React.createElement(
				View,
				{ style: styles.actions },
				React.createElement(
					Pressable,
					{
						style: styles.btn,
						onPress: () => {
							if (Platform.OS === 'web' && typeof window !== 'undefined') {
								try {
									window.location.reload()
								} catch {
									// ignore
								}
							}
						},
					},
					React.createElement(Text, { style: styles.btnText }, '再読み込み')
				),
				React.createElement(
					Pressable,
					{
						style: [styles.btn, styles.btnSecondary] as any,
						onPress: () => {
							if (Platform.OS === 'web' && typeof window !== 'undefined') {
								try {
									window.location.href = '/login'
								} catch {
									// ignore
								}
							}
						},
					},
					React.createElement(Text, { style: styles.btnText }, 'ログインへ')
				)
			),
			React.createElement(Text, { selectable: true, style: styles.errorText } as any, `Error: ${message}`)
		)
	}
}

function Root() {
	return React.createElement(RootErrorBoundary, null, React.createElement(App, null))
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		padding: 16,
		backgroundColor: '#fff',
		justifyContent: 'center',
	},
	title: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 8,
	},
	desc: {
		fontSize: 13,
		color: '#444',
		marginBottom: 16,
		lineHeight: 18,
	},
	actions: {
		flexDirection: 'row',
		gap: 10,
		marginBottom: 16,
	},
	btn: {
		paddingVertical: 10,
		paddingHorizontal: 12,
		backgroundColor: '#111',
		borderRadius: 8,
	},
	btnSecondary: {
		backgroundColor: '#444',
	},
	btnText: {
		color: '#fff',
		fontWeight: '700',
	},
	errorText: {
		marginTop: 8,
		fontSize: 12,
		color: '#b00020',
	},
})

registerRootComponent(Root)
