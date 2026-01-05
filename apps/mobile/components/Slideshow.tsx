import type { MutableRefObject } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { PagedCarousel, type PagedCarouselController } from './PagedCarousel'

type SlideshowProps = {
  images: Array<ReturnType<typeof require>>
  height: number
  index: number
  onIndexChange: (index: number) => void
  resizeMode?: 'contain' | 'cover'
  controllerRef?: MutableRefObject<PagedCarouselController | null>
}

export function Slideshow({ images, height, index, onIndexChange, resizeMode = 'contain', controllerRef }: SlideshowProps) {
  return (
    <PagedCarousel
      items={images}
      index={index}
      onIndexChange={onIndexChange}
      height={height + 44}
      controllerRef={controllerRef}
      renderItem={(src) => (
        <View style={styles.slide}>
          <Image source={src} style={[styles.image, { height }]} resizeMode={resizeMode} />
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
  },
})
