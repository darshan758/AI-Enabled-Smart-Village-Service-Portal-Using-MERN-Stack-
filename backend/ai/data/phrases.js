// Training phrase bank for the complaint classifier.
// Each entry: [text, basePriority]  (0 Low, 1 Medium, 2 High, 3 Critical).
// Written by the project team in three styles that real villagers use:
//   en = English, kn = Kannada script, rm = Kannada written in English letters.
// Priority is the team's judgement of the issue itself; urgency modifiers
// (see MODIFIERS in train.js) can raise or lower it.

module.exports = {
  'Road Damage': {
    en: [
      ['There is a big pothole on the main road', 2], ['The road is badly damaged and full of potholes', 1],
      ['Road has cracks and is breaking apart', 0], ['Huge pit in the middle of the road, vehicles are struggling', 2],
      ['The village road has not been repaired for years', 1], ['Tar road washed away after the rain', 2],
      ['Road collapsed near the bridge', 3], ['Bad road condition, bikes are slipping on loose stones', 2],
      ['Speed breaker is broken and the road surface is uneven', 0], ['Mud road is impossible to walk after rain, needs concrete', 1],
      ['Road cave-in has formed a deep hole', 3], ['Footpath tiles are broken and the road edge is damaged', 0],
    ],
    kn: [
      ['ರಸ್ತೆಯಲ್ಲಿ ದೊಡ್ಡ ಗುಂಡಿ ಬಿದ್ದಿದೆ', 2], ['ರಸ್ತೆ ಹಾಳಾಗಿದೆ ವಾಹನ ಓಡಿಸಲು ಕಷ್ಟ', 1],
      ['ಊರಿನ ರಸ್ತೆ ಒಡೆದು ಹೋಗಿದೆ', 1], ['ರಸ್ತೆಯಲ್ಲಿ ಹೊಂಡಗಳು ತುಂಬಿವೆ', 1], ['ಸೇತುವೆ ಬಳಿ ರಸ್ತೆ ಕುಸಿದಿದೆ', 3],
    ],
    rm: [
      ['rasteyalli dodda gundi bidide', 2], ['raste halagide vahana odisalu kashta', 1],
      ['ooru raste odedu hogide', 1], ['rasteyalli hondagalu tumbive', 1], ['setuve bali raste kusidide', 3],
    ],
  },
  'Street Light Damage': {
    en: [
      ['Street light is not working', 1], ['The street lamp near my house has stopped glowing', 0],
      ['No lights on the road at night, it is completely dark', 1], ['Street light pole bulb is fused', 0],
      ['Lamp post light keeps flickering', 0], ['All street lights in our lane are off', 1],
      ['Light is broken and hanging from the pole', 2], ['Dark street, women feel unsafe because the lamps are not working', 2],
      ['Streetlight switched on during the day and off at night', 0], ['Highway light has been out of order for weeks', 1],
      ['The solar street light is not charging', 0], ['Please replace the damaged street lamp', 0],
    ],
    kn: [
      ['ಬೀದಿ ದೀಪ ಉರಿಯುತ್ತಿಲ್ಲ', 1], ['ರಾತ್ರಿ ರಸ್ತೆಯಲ್ಲಿ ದೀಪ ಇಲ್ಲ ಕತ್ತಲೆ', 1], ['ಕಂಬದ ದೀಪ ಕೆಟ್ಟು ಹೋಗಿದೆ', 0],
      ['ಬೀದಿ ದೀಪಗಳು ಹಾಳಾಗಿವೆ', 1], ['ದೀಪ ಮಿಣುಕುತ್ತಿದೆ ಸರಿಪಡಿಸಿ', 0],
    ],
    rm: [
      ['beedi deepa urita illa', 1], ['ratri rasteyalli deepa illa kattale', 1], ['kambada deepa kettu hogide', 0],
      ['beedi deepagalu halagive', 1], ['deepa minukuttide saripadisi', 0],
    ],
  },
  'Water Leakage': {
    en: [
      ['Water pipe is leaking on the road', 1], ['Drinking water pipeline burst and water is wasting', 2],
      ['There is no water coming in the tap for three days', 2], ['Water tank is overflowing and leaking', 1],
      ['Pipe joint is leaking near the hand pump', 0], ['Dirty water is coming in the drinking water supply', 2],
      ['Main water line broke and the street is flooded', 2], ['Tap water supply is very low pressure', 0],
      ['Borewell pipe leakage near the school', 1], ['Water supply timing is irregular and pipes are dripping', 0],
      ['Overhead tank valve is leaking continuously', 1], ['Water is being wasted from a broken public tap', 0],
    ],
    kn: [
      ['ನೀರಿನ ಪೈಪ್ ಒಡೆದು ನೀರು ಸೋರುತ್ತಿದೆ', 1], ['ಕುಡಿಯುವ ನೀರಿನ ಪೈಪ್ ಲೀಕ್ ಆಗುತ್ತಿದೆ', 1], ['ನಲ್ಲಿಯಲ್ಲಿ ನೀರು ಬರುತ್ತಿಲ್ಲ', 2],
      ['ಪೈಪ್ ಲೈನ್ ಒಡೆದು ನೀರು ವ್ಯರ್ಥವಾಗುತ್ತಿದೆ', 1], ['ಟ್ಯಾಂಕ್ ನೀರು ಸೋರುತ್ತಿದೆ', 1],
    ],
    rm: [
      ['neerina pipe odedu neeru soruttide', 1], ['kudiyuva neerina pipe leak aaguttide', 1], ['nalliyalli neeru baruttilla', 2],
      ['pipe line odedu neeru vyartha aaguttide', 1], ['tank neeru soruttide', 1],
    ],
  },
  'Garbage Issue': {
    en: [
      ['Garbage is not being collected for a week', 1], ['Waste is dumped on the roadside and smells bad', 1],
      ['Dustbin is overflowing and trash is spread everywhere', 1], ['Garbage pile near the market is attracting stray dogs', 1],
      ['People are burning plastic waste near the houses', 2], ['No garbage collection vehicle comes to our street', 0],
      ['Rubbish heap beside the school ground', 1], ['Dead animal is lying in the garbage dump', 2],
      ['Please clean the litter around the bus stand', 0], ['Waste dumped in the empty plot, mosquitoes are increasing', 1],
      ['Plastic and trash blocking the lane', 0], ['Open dumping yard is spreading foul smell in the village', 1],
    ],
    kn: [
      ['ಕಸ ತೆಗೆಯುತ್ತಿಲ್ಲ ರಾಶಿ ಬಿದ್ದಿದೆ', 1], ['ರಸ್ತೆ ಬದಿ ಕಸ ಸುರಿದಿದ್ದಾರೆ ದುರ್ವಾಸನೆ', 1], ['ಕಸದ ಬುಟ್ಟಿ ತುಂಬಿ ಹೊರಗೆ ಚೆಲ್ಲಿದೆ', 0],
      ['ವಾರದಿಂದ ಕಸ ಸಂಗ್ರಹ ಆಗಿಲ್ಲ', 1], ['ತ್ಯಾಜ್ಯ ರಾಶಿ ಬಿದ್ದು ನಾಯಿಗಳು ಹರಡುತ್ತಿವೆ', 1],
    ],
    rm: [
      ['kasa teyuttilla rashi bididide', 1], ['raste badi kasa surididdare durvasane', 1], ['kasada butti tumbi horage chellide', 0],
      ['varadinda kasa sangraha aagilla', 1], ['tyajya rashi biddu naayigalu harDuttive', 1],
    ],
  },
  'Drainage Problem': {
    en: [
      ['Drain is blocked and water is not flowing', 1], ['Sewage is overflowing onto the road', 2],
      ['Open drain full of silt and mosquitoes', 1], ['Rain water is entering our houses because the drain is choked', 2],
      ['Manhole cover is missing and sewage is spilling', 3], ['Gutter water is flowing into the street', 2],
      ['Drainage canal needs cleaning before the monsoon', 0], ['Foul smell from the blocked underground drainage', 1],
      ['Sewer line has broken near the well', 2], ['Stagnant water in the drain is breeding mosquitoes', 1],
      ['Culvert is jammed with plastic, water is logging', 1], ['Drain slab is broken and someone may fall in', 2],
    ],
    kn: [
      ['ಚರಂಡಿ ಕಟ್ಟಿಕೊಂಡಿದೆ ನೀರು ಹರಿಯುತ್ತಿಲ್ಲ', 1], ['ಚರಂಡಿ ನೀರು ರಸ್ತೆಗೆ ಹರಿಯುತ್ತಿದೆ', 2], ['ಒಳಚರಂಡಿ ಉಕ್ಕಿ ಹರಿಯುತ್ತಿದೆ', 2],
      ['ಚರಂಡಿಯಲ್ಲಿ ಹೂಳು ತುಂಬಿದೆ ಸೊಳ್ಳೆ', 1], ['ಮಳೆ ನೀರು ಮನೆಗೆ ನುಗ್ಗುತ್ತಿದೆ', 2],
    ],
    rm: [
      ['charandi kattikondide neeru hariyuttilla', 1], ['charandi neeru rastege hariyuttide', 2], ['olacharandi ukki hariyuttide', 2],
      ['charandiyalli hoolu tumbide solle', 1], ['male neeru manege nugguttide', 2],
    ],
  },
  'Electricity Problem': {
    en: [
      ['Electric wire has fallen on the road', 3], ['No power in our village since two days', 2],
      ['Electric pole is leaning and may fall', 3], ['Transformer is sparking and making noise', 3],
      ['Frequent power cuts every evening', 1], ['Low voltage, fans and lights barely work', 1],
      ['Live wires are hanging low near the houses', 3], ['Electricity meter is not working properly', 0],
      ['Power outage in the whole ward after the storm', 2], ['Burnt transformer needs to be replaced', 2],
      ['Loose electric cable touching the tree', 2], ['New electricity connection pole is needed in our street', 0],
    ],
    kn: [
      ['ವಿದ್ಯುತ್ ತಂತಿ ಕತ್ತರಿಸಿ ಬಿದ್ದಿದೆ', 3], ['ಕರೆಂಟ್ ಇಲ್ಲ ಎರಡು ದಿನದಿಂದ', 2], ['ವಿದ್ಯುತ್ ಕಂಬ ವಾಲಿದೆ ಅಪಾಯ', 3],
      ['ಟ್ರಾನ್ಸ್‌ಫಾರ್ಮರ್ ಸುಟ್ಟು ಹೋಗಿದೆ', 2], ['ವಿದ್ಯುತ್ ವ್ಯತ್ಯಯ ಪದೇ ಪದೇ ಆಗುತ್ತಿದೆ', 1],
    ],
    rm: [
      ['vidyut tanti kattarisi bididide', 3], ['current illa eradu dinadinda', 2], ['vidyut kamba vaalide apaya', 3],
      ['transformer suttu hogide', 2], ['vidyut vyatyaya pade pade aaguttide', 1],
    ],
  },
  'Others': {
    en: [
      ['Stray dogs are attacking people in our street', 2], ['There is no public toilet in the village market', 0],
      ['A big tree has fallen and is blocking the road', 2], ['Loud music and noise from the function hall at night', 0],
      ['Anganwadi building needs repair', 1], ['Illegal encroachment on the government land', 0],
      ['Bus stop shelter is broken', 0], ['Playground is occupied by parked vehicles', 0],
      ['Cattle are roaming on the highway and causing accidents', 2], ['Request to build a compound wall for the school', 0],
      ['Public library is closed for months', 0], ['Beehive on the community hall is dangerous for children', 2],
    ],
    kn: [
      ['ಬೀದಿ ನಾಯಿಗಳ ಕಾಟ ಹೆಚ್ಚಾಗಿದೆ', 2], ['ಸಾರ್ವಜನಿಕ ಶೌಚಾಲಯ ಇಲ್ಲ', 0], ['ಮರ ಬಿದ್ದು ದಾರಿ ಮುಚ್ಚಿದೆ', 2],
      ['ಜೋರಾಗಿ ಶಬ್ದ ಮಾಡುತ್ತಿದ್ದಾರೆ', 0], ['ಅಂಗನವಾಡಿ ಕಟ್ಟಡ ದುರಸ್ತಿ ಬೇಕು', 1],
    ],
    rm: [
      ['beedi naayigala kaata hechchagide', 2], ['sarvajanika shouchalaya illa', 0], ['mara biddu daari muchchide', 2],
      ['joragi shabda maduttiddare', 0], ['anganawadi kattada durusti beku', 1],
    ],
  },
};