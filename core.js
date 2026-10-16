/* Hana core: code shared by the customer app (app.js) and the business tools page
   (business.js). Plain JavaScript, no libraries, no build step. Every value from a
   menu file is shown as plain text (textContent), never as HTML. See SPEC.md. */
"use strict";

/* Icon outlines from Material Symbols (Outlined, weight 400), package
   @material-symbols/svg-400 version 0.47.5, Apache License 2.0, copyright Google LLC.
   See theme/material-symbols-LICENSE.txt. */
const ICONS = {
  favorite: "m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q57 0 105.5 27t84.5 78q42-54 89-79.5T670-854q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Zm0-79q101.24-93 166.62-159.5Q712-426 750.5-476t54-89.14q15.5-39.13 15.5-77.72 0-66.14-42-108.64T670.22-794q-51.52 0-95.37 31.5T504-674h-49q-26-56-69.85-88-43.85-32-95.37-32Q224-794 182-751.5t-42 108.82q0 38.68 15.5 78.18 15.5 39.5 54 90T314-358q66 66 166 158Zm0-297Z",
  favorite_fill: "m480-121-41-37q-106-97-175-167.5t-110-126Q113-507 96.5-552T80-643q0-90 60.5-150.5T290-854q57 0 105.5 27t84.5 78q42-54 89-79.5T670-854q89 0 149.5 60.5T880-643q0 46-16.5 91T806-451.5q-41 55.5-110 126T521-158l-41 37Z",
  fingerprint: "M481-779q108 0 203.5 46T843-601q3 5 2.5 8t-3.5 6q-3 3-7.5 3t-8.5-5q-59-82-150.5-126T481-759q-103 0-193 44.5T138-589q-4 5-7.5 6t-7.5-1q-4-2-4-6.5t2-8.5q62-86 157-133t203-47Zm0 96q136 0 233.5 90T812-371q0 46-34 78t-82 32q-49 0-84-32t-35-78q0-39-28.5-65T481-462q-39 0-68 26t-29 65q0 104 63 173.5T604-100q6 2 7.5 5t.5 7q-1 5-4 7t-8 0q-103-26-169.5-103T364-371q0-47 34.5-79t82.5-32q48 0 82.5 32t34.5 79q0 38 29.5 64t68.5 26q38 0 66.5-26t28.5-64q0-123-91.5-206T481-660q-127 0-218.5 83T171-371q0 24 5.5 62.5T200-221q2 5 0 7.5t-5 4.5q-4 2-8.5 1t-6.5-6q-13-38-20.5-77.5T152-371q0-129 98-220.5T481-683Zm0-197q65 0 127.5 16T728-819q5 2 5.5 6t-1.5 7q-2 3-5.5 5t-8.5 0q-55-27-115-42.5T481-859q-62 0-121 14.5T247-801q-5 2-7.5.5T235-805q-2-2-2-6t3-6q57-31 119.5-47T481-880Zm0 298q92 0 158.5 61T706-371q0 5-2.5 7.5T696-361q-5 0-8-2.5t-3-7.5q0-81-60.5-136T481-562q-83 0-142.5 55T279-371q0 85 29.5 145T396-106q4 4 3.5 7.5T396-92q-2 2-6.5 3.5T381-92q-58-60-90.5-126T258-371q0-89 65.5-150T481-582Zm-1 200q5 0 7.5 3t2.5 8q0 81 59.5 133.5T687-185q8 0 19-1t24-3q5-1 8 1.5t4 5.5q1 4-.5 7t-6.5 4q-18 5-31.5 5.5t-16.5.5q-88 0-152.5-58.5T470-371q0-5 2.5-8t7.5-3Z",
  logout: "M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h299v60H180v600h299v60H180Zm486-185-43-43 102-102H360v-60h363L621-612l43-43 176 176-174 174Z",
  settings: "m388-80-20-126q-19-7-40-19t-37-25l-118 54-93-164 108-79q-2-9-2.5-20.5T185-480q0-9 .5-20.5T188-521L80-600l93-164 118 54q16-13 37-25t40-18l20-127h184l20 126q19 7 40.5 18.5T669-710l118-54 93 164-108 77q2 10 2.5 21.5t.5 21.5q0 10-.5 21t-2.5 21l108 78-93 164-118-54q-16 13-36.5 25.5T592-206L572-80H388Zm48-60h88l14-112q33-8 62.5-25t53.5-41l106 46 40-72-94-69q4-17 6.5-33.5T715-480q0-17-2-33.5t-7-33.5l94-69-40-72-106 46q-23-26-52-43.5T538-708l-14-112h-88l-14 112q-34 7-63.5 24T306-642l-106-46-40 72 94 69q-4 17-6.5 33.5T245-480q0 17 2.5 33.5T254-413l-94 69 40 72 106-46q24 24 53.5 41t62.5 25l14 112Zm44-210q54 0 92-38t38-92q0-54-38-92t-92-38q-54 0-92 38t-38 92q0 54 38 92t92 38Zm0-130Z",
  light_mode: "M579-381q41-41 41-99t-41-99q-41-41-99-41t-99 41q-41 41-41 99t41 99q41 41 99 41t99-41Zm-240.5 42.5Q280-397 280-480t58.5-141.5Q397-680 480-680t141.5 58.5Q680-563 680-480t-58.5 141.5Q563-280 480-280t-141.5-58.5ZM200-450H40v-60h160v60Zm720 0H760v-60h160v60ZM450-760v-160h60v160h-60Zm0 720v-160h60v160h-60ZM262-658l-100-97 43-44 96 100-39 41Zm494 496-98-100 41-41 99 98-42 43Zm-99-537 98-99 44 42-99 98-43-41ZM162-205l99-98 42 42-98 99-43-43Zm318-275Z",
  dark_mode: "M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q8 0 17 .5t23 1.5q-36 32-56 79t-20 99q0 90 63 153t153 63q52 0 99-18.5t79-51.5q1 12 1.5 19.5t.5 14.5q0 150-105 255T480-120Zm0-60q109 0 190-67.5T771-406q-25 11-53.67 16.5Q688.67-384 660-384q-114.69 0-195.34-80.66Q384-545.31 384-660q0-24 5-51.5t18-62.5q-98 27-162.5 109.5T180-480q0 125 87.5 212.5T480-180Zm-4-297Z",
  brightness_auto: "M310-305h55l37-109h159l38 109h53L505-697h-48L310-305Zm107-157 61-163h5l62 163H417Zm64 433L346-160H160v-186L26-480l134-134v-186h186l135-134 133 134h186v186l134 134-134 134v186H614L481-29Zm0-84 108-107h151v-151l109-109-109-109v-151H589L481-849 371-740H220v151L111-480l109 109v151h150l111 107Zm0-368Z",
  upload: "M450-313v-371L330-564l-43-43 193-193 193 193-43 43-120-120v371h-60ZM220-160q-24 0-42-18t-18-42v-143h60v143h520v-143h60v143q0 24-18 42t-42 18H220Z",
  key: "M232-432q-20-20-20-48t20-48q20-20 48-20t48 20q20 20 20 48t-20 48q-20 20-48 20t-48-20Zm48 192q-100 0-170-70T40-480q0-100 70-170t170-70q72 0 126 34t85 103h356l113 113-167 153-88-64-88 64-75-60h-51q-25 60-78.5 98.5T280-240Zm0-60q58 0 107-38.5t63-98.5h114l54 45 88-63 82 62 85-79-51-51H450q-12-56-60-96.5T280-660q-75 0-127.5 52.5T100-480q0 75 52.5 127.5T280-300Z",
  verified: "m346-60-76-130-151-31 17-147-96-112 96-111-17-147 151-31 76-131 134 62 134-62 77 131 150 31-17 147 96 111-96 112 17 147-150 31-77 130-134-62-134 62Zm27-79 107-45 110 45 67-100 117-30-12-119 81-92-81-94 12-119-117-28-69-100-108 45-110-45-67 100-117 28 12 119-81 94 81 92-12 121 117 28 70 100Zm107-341Zm-43 133 227-225-45-41-182 180-95-99-46 45 141 140Z",
  edit_note: "M160-410v-60h300v60H160Zm0-165v-60h470v60H160Zm0-165v-60h470v60H160Zm360 580v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q9 9 13 20t4 22q0 11-4.5 22.5T862.09-380L643-160H520Zm300-263-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z",
  add_business: "M726-40v-121H606v-60h120v-120h60v120h120v60H786v121h-60ZM104-161v-257H54v-60l44-202h602l45 207v55h-49v167h-60v-167H420v257H104Zm60-60h196v-197H164v197Zm-50-257h572-572ZM98-740v-60h603v60H98Zm16 262h572l-31-142H145l-31 142Z",
  open_in_new: "M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h279v60H180v600h600v-279h60v279q0 24-18 42t-42 18H180Zm202-219-42-43 398-398H519v-60h321v321h-60v-218L382-339Z",
  storefront: "M840-519v339q0 24-18 42t-42 18H179q-24 0-42-18t-18-42v-339q-28-24-37-59t2-70l43-135q8-27 28-42t46-15h553q28 0 49 15.5t29 41.5l44 135q11 35 1.5 70T840-519Zm-270-31q29 0 49-19t16-46l-25-165H510v165q0 26 17 45.5t43 19.5Zm-187 0q28 0 47.5-19t19.5-46v-165H350l-25 165q-4 26 14 45.5t44 19.5Zm-182 0q24 0 41.5-16.5T263-607l26-173H189l-46 146q-10 31 8 57.5t50 26.5Zm557 0q32 0 50.5-26t8.5-58l-46-146H671l26 173q3 24 20.5 40.5T758-550ZM179-180h601v-311q1 1-6.5 1H758q-25 0-47.5-10.5T666-533q-16 20-40 31.5T573-490q-30 0-51.5-8.5T480-527q-15 18-38 27.5t-52 9.5q-31 0-55-11t-41-32q-24 21-47 32t-46 11h-13.5q-6.5 0-8.5-1v311Zm601 0H179h601Z",
  shopping_bag: "M220-80q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h110v-10q0-63 43.5-106.5T480-880q63 0 106.5 43.5T630-730v10h110q24 0 42 18t18 42v520q0 24-18 42t-42 18H220Zm0-60h520v-520H630v90q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-90H390v90q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-90H220v520Zm170-580h180v-10q0-38-26-64t-64-26q-38 0-64 26t-26 64v10ZM220-140v-520 520Z",
  receipt_long: "M222-80q-43.75 0-74.37-30.63Q117-141.25 117-185v-125h127v-570l59.8 60 59.8-60 59.8 60 59.8-60 59.8 60 60-60 60 60 60-60 60 60 60-60v695q0 43.75-30.62 74.37Q781.75-80 738-80H222Zm516-60q20 0 32.5-12.5T783-185v-595H304v470h389v125q0 20 12.5 32.5T738-140ZM357-622v-60h240v60H357Zm0 134v-60h240v60H357Zm333-134q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9Zm0 129q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9ZM221-140h412v-110H177v65q0 20 12.65 32.5T221-140Zm-44 0v-110 110Z",
  arrow_upward: "M450-160v-526L202-438l-42-42 320-320 320 320-42 42-248-248v526h-60Z",
  arrow_downward: "M450-800v526L202-522l-42 42 320 320 320-320-42-42-248 248v-526h-60Z",
  cloud_upload: "M250-160q-86 0-148-62T40-370q0-78 49.5-137.5T217-579q20-97 94-158.5T482-799q113 0 189.5 81.5T748-522v24q72-2 122 46.5T920-329q0 69-50 119t-119 50H510q-24 0-42-18t-18-42v-258l-83 83-43-43 156-156 156 156-43 43-83-83v258h241q45 0 77-32t32-77q0-45-32-77t-77-32h-63v-84q0-89-60.5-153T478-739q-89 0-150 64t-61 153h-19q-62 0-105 43.5T100-371q0 62 43.93 106.5T250-220h140v60H250Zm230-290Z",
  inbox: "M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Zm0-60h600v-136H634q-26 40-67.5 61.5T480-233q-45 0-86.5-21.5T326-316H180v136Zm374-136.5q33-23.5 56-59.5h170v-404H180v404h170q23 36 56.25 59.5 33.24 23.5 74 23.5Q521-293 554-316.5ZM180-180h600-600Z",
  link: "M450-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h170v60H280q-58.33 0-99.17 40.76-40.83 40.77-40.83 99Q140-422 180.83-381q40.84 41 99.17 41h170v60ZM325-450v-60h310v60H325Zm185 170v-60h170q58.33 0 99.17-40.76 40.83-40.77 40.83-99Q820-538 779.17-579q-40.84-41-99.17-41H510v-60h170q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H510Z",
  share: "M686-80q-47.5 0-80.75-33.25T572-194q0-8 5-34L278-403q-16.28 17.34-37.64 27.17Q219-366 194-366q-47.5 0-80.75-33T80-480q0-48 33.25-81T194-594q24 0 45 9.3 21 9.29 37 25.7l301-173q-2-8-3.5-16.5T572-766q0-47.5 33.25-80.75T686-880q47.5 0 80.75 33.25T800-766q0 47.5-33.25 80.75T686-652q-23.27 0-43.64-9Q622-670 606-685L302-516q3 8 4.5 17.5t1.5 18q0 8.5-1 16t-3 15.5l303 173q16-15 36.09-23.5 20.1-8.5 43.07-8.5Q734-308 767-274.75T800-194q0 47.5-33.25 80.75T686-80Zm.04-60q22.96 0 38.46-15.54 15.5-15.53 15.5-38.5 0-22.96-15.54-38.46-15.53-15.5-38.5-15.5-22.96 0-38.46 15.54-15.5 15.53-15.5 38.5 0 22.96 15.54 38.46 15.53 15.5 38.5 15.5Zm-492-286q22.96 0 38.46-15.54 15.5-15.53 15.5-38.5 0-22.96-15.54-38.46-15.53-15.5-38.5-15.5-22.96 0-38.46 15.54-15.5 15.53-15.5 38.5 0 22.96 15.54 38.46 15.53 15.5 38.5 15.5ZM724.5-727.54q15.5-15.53 15.5-38.5 0-22.96-15.54-38.46-15.53-15.5-38.5-15.5-22.96 0-38.46 15.54-15.5 15.53-15.5 38.5 0 22.96 15.54 38.46 15.53 15.5 38.5 15.5 22.96 0 38.46-15.54ZM686-194ZM194-480Zm492-286Z",
  tune: "M427-120v-225h60v83h353v60H487v82h-60Zm-307-82v-60h247v60H120Zm187-166v-82H120v-60h187v-84h60v226h-60Zm120-82v-60h413v60H427Zm166-165v-225h60v82h187v60H653v83h-60Zm-473-83v-60h413v60H120Z",
  expand_more: "M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z",
  info: "M453-280h60v-240h-60v240Zm50.5-323.2q9.5-9.2 9.5-22.8 0-14.45-9.48-24.22-9.48-9.78-23.5-9.78t-23.52 9.78Q447-640.45 447-626q0 13.6 9.48 22.8 9.48 9.2 23.5 9.2t23.52-9.2ZM480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z",
  search: "M796-121 533-384q-30 26-70 40.5T378-329q-108 0-183-75t-75-181q0-106 75-181t182-75q106 0 180.5 75T632-585q0 43-14 83t-42 75l264 262-44 44ZM377-389q81 0 138-57.5T572-585q0-81-57-138.5T377-781q-82 0-139.5 57.5T180-585q0 81 57.5 138.5T377-389Z",
  add: "M450-450H200v-60h250v-250h60v250h250v60H510v250h-60v-250Z",
  remove: "M200-450v-60h560v60H200Z",
  arrow_back: "m274-450 248 248-42 42-320-320 320-320 42 42-248 248h526v60H274Z",
  arrow_drop_down: "M480-360 280-559h400L480-360Z",
  delete: "M261-120q-24.75 0-42.37-17.63Q201-155.25 201-180v-570h-41v-60h188v-30h264v30h188v60h-41v570q0 24-18 42t-42 18H261Zm438-630H261v570h438v-570ZM367-266h60v-399h-60v399Zm166 0h60v-399h-60v399ZM261-750v570-570Z",
  content_copy: "M300-200q-24 0-42-18t-18-42v-560q0-24 18-42t42-18h440q24 0 42 18t18 42v560q0 24-18 42t-42 18H300Zm0-60h440v-560H300v560ZM180-80q-24 0-42-18t-18-42v-620h60v620h500v60H180Zm120-180v-560 560Z",
  chat: "M240-399h313v-60H240v60Zm0-130h480v-60H240v60Zm0-130h480v-60H240v60ZM80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z",
  call: "M795-120q-116 0-236.5-56T335-335Q232-438 176-558.5T120-795q0-19.29 12.86-32.14Q145.71-840 165-840h140q14 0 24 10t14 25l26.93 125.64Q372-665 369.5-653.5t-10.73 19.73L259-533q26 44 55 82t64 72q37 38 78 69.5t86 55.5l95-98q10-11 23.15-15 13.15-4 25.85-2l119 26q15 4 25 16.04 10 12.05 10 26.96v135q0 19.29-12.86 32.14Q814.29-120 795-120ZM229-588l81-82-23-110H180q2 42 13.5 88.5T229-588Zm369 363q41 19 89 31t93 14v-107l-103-21-79 83ZM229-588Zm369 363Z",
  sms: "M334.5-534.5Q346-546 346-563t-11.5-28.5Q323-603 306-603t-28.5 11.5Q266-580 266-563t11.5 28.5Q289-523 306-523t28.5-11.5Zm177 0Q523-546 523-563t-11.5-28.5Q500-603 483-603t-28.5 11.5Q443-580 443-563t11.5 28.5Q466-523 483-523t28.5-11.5Zm170 0Q693-546 693-563t-11.5-28.5Q670-603 653-603t-28.5 11.5Q613-580 613-563t11.5 28.5Q636-523 653-523t28.5-11.5ZM80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z",
  location_on: "M529.5-510.5Q550-531 550-560t-20.5-49.5Q509-630 480-630t-49.5 20.5Q410-589 410-560t20.5 49.5Q451-490 480-490t49.5-20.5ZM480-159q133-121 196.5-219.5T740-552q0-118-75.5-193T480-820q-109 0-184.5 75T220-552q0 75 65 173.5T480-159Zm0 79Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z",
  schedule: "m627-287 45-45-159-160v-201h-60v225l174 181ZM480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-82 31.5-155t86-127.5Q252-817 325-848.5T480-880q82 0 155 31.5t127.5 86Q817-708 848.5-635T880-480q0 82-31.5 155t-86 127.5Q708-143 635-111.5T480-80Zm0-400Zm0 340q140 0 240-100t100-240q0-140-100-240T480-820q-140 0-240 100T140-480q0 140 100 240t240 100Z",
  check_circle: "m421-298 283-283-46-45-237 237-120-120-45 45 165 166Zm59 218q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z",
  warning: "m40-120 440-760 440 760H40Zm104-60h672L480-760 144-180Zm361.5-65.68q8.5-8.67 8.5-21.5 0-12.82-8.68-21.32-8.67-8.5-21.5-8.5-12.82 0-21.32 8.68-8.5 8.67-8.5 21.5 0 12.82 8.68 21.32 8.67 8.5 21.5 8.5 12.82 0 21.32-8.68ZM454-348h60v-224h-60v224Zm26-122Z",
  close: "m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z",
  download: "M480-313 287-506l43-43 120 120v-371h60v371l120-120 43 43-193 193ZM220-160q-24 0-42-18t-18-42v-143h60v143h520v-143h60v143q0 24-18 42t-42 18H220Z",
  send: "M120-160v-640l760 320-760 320Zm60-93 544-227-544-230v168l242 62-242 60v167Zm0 0v-457 457Z",
  moped: "M192-234.5Q158-269 158-317H80v-120q0-65 45-110.5T235-593h155v216h161l147-185v-138H575v-60h123q24.75 0 42.38 17.62Q758-724.75 758-700v159L580-317H390q0 48-33.76 82.5-33.77 34.5-82 34.5Q226-200 192-234.5ZM330-377Zm-16.5 100q16.5-17 16.5-40H218q0 23 16.5 40t39.5 17q23 0 39.5-17ZM200-653v-60h190v60H200Zm482 419.24q-34-33.77-34-82Q648-364 681.76-398q33.77-34 82-34Q812-432 846-398.24q34 33.77 34 82Q880-268 846.24-234q-33.77 34-82 34Q716-200 682-233.76Zm121.5-42.74Q820-293 820-316t-16.5-39.5Q787-372 764-372t-39.5 16.5Q708-339 708-316t16.5 39.5Q741-260 764-260t39.5-16.5ZM140-377h190v-156h-95q-40 0-67.5 28.2T140-437v60Z",
};

/* ---------------------------------------------------------------- dark mode follows the phone */

/* Colour mode: "system" (follow the phone), "light" or "dark". The choice is kept on this phone. */
const THEME_MODES = ["system", "light", "dark"];
const THEME_LABEL = { system: "Colour mode: follows your phone", light: "Colour mode: light", dark: "Colour mode: dark" };
const THEME_ICON = { system: "brightness_auto", light: "light_mode", dark: "dark_mode" };
const themeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function themeMode() {
  try { const m = localStorage.getItem("hana.theme"); return THEME_MODES.includes(m) ? m : "system"; } catch (e) { return "system"; }
}

/* ---------------------------------------------------------------- settings (kept on this device) */

const SCHEMES = { mono: "Black and white (default)", clay: "Clay", teal: "Teal", indigo: "Indigo", green: "Green", plum: "Plum", contrast: "High contrast" };
const TEXT_SIZES = { normal: "Default", large: "Large", larger: "Larger" };
function settings() {
  const d = { scheme: "mono", text: "normal", pictures: true };
  try { return Object.assign(d, JSON.parse(localStorage.getItem("hana.settings") || "{}")); } catch (e) { return d; }
}
function saveSettings(s) { try { localStorage.setItem("hana.settings", JSON.stringify(s)); } catch (e) { /* this visit only */ } applyTheme(); }

function applyTheme() {
  const st = settings();
  const SCHEME_CLASS = { mono: "scheme-mono", teal: "scheme-teal", indigo: "scheme-indigo", green: "scheme-green", plum: "scheme-plum", contrast: "scheme-contrast" };
  for (const [k, cls] of Object.entries(SCHEME_CLASS)) document.body.classList.toggle(cls, st.scheme === k);
  document.documentElement.classList.toggle("text-large", st.text === "large");
  document.documentElement.classList.toggle("text-larger", st.text === "larger");
  const mode = themeMode();
  const dark = mode === "dark" || (mode === "system" && !!(themeQuery && themeQuery.matches));
  document.body.classList.toggle("dark", dark);
  document.body.classList.toggle("light", !dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#1a110f" : "#9a3412");
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    /* The icon shows the look on screen now (a sun or a moon), so it is never mistaken for Settings. */
    const darkNow = mode === "dark" || (mode === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    btn.replaceChildren(icon(darkNow ? "dark_mode" : "light_mode"));
    btn.setAttribute("aria-label", THEME_LABEL[mode] + ". Select to change.");
    btn.setAttribute("title", THEME_LABEL[mode]);
  }
}

/* The toggle cycles through: follow the phone, light, dark. */
function setupThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const next = THEME_MODES[(THEME_MODES.indexOf(themeMode()) + 1) % THEME_MODES.length];
      try { localStorage.setItem("hana.theme", next); } catch (e) { /* the choice lasts for this visit only */ }
      applyTheme();
      if (typeof snackbar === "function") snackbar(THEME_LABEL[next] + ".");
    });
  }
  if (themeQuery && themeQuery.addEventListener) themeQuery.addEventListener("change", applyTheme);
  applyTheme();
}

/* ---------------------------------------------------------------- helpers */

/* Empty parts (null, undefined, false) are skipped everywhere, so a conditional part of a
   page can never show up as the word "null". */
for (const name of ["append", "replaceChildren"]) {
  const orig = Element.prototype[name];
  Element.prototype[name] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false)); };
}

function h(tag, attrs) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of Array.prototype.slice.call(arguments, 2).flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

const SVGNS = "http://www.w3.org/2000/svg";
function icon(name) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 -960 960 960");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const p = document.createElementNS(SVGNS, "path");
  p.setAttribute("d", ICONS[name] || "");
  p.setAttribute("fill", "currentColor");
  svg.append(p);
  const i = document.createElement("i");
  i.append(svg);
  return i;
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) {
      /* Storage full or blocked: say so, because an order record must never vanish silently. */
      if (typeof snackbar === "function") snackbar("This phone's browser storage is full or blocked, so this could not be saved. Download your data under Settings, then clear old orders.");
      return false;
    }
  },
};

/* Money in Bangladeshi taka, written with the ISO code and Canadian digit grouping. */
const money = (n) => "BDT " + Number(n).toLocaleString("en-CA");
/* A listed price, or a note that the business gives it when it confirms. */
const NO_PRICE = "Price on request";
const priceOrAsk = (n) => (n === null || n === undefined ? NO_PRICE : money(n));

/* 24-hour "19:00" to "7 p.m.", "03:30" to "3:30 a.m.", "00:00" to "midnight", "12:00" to "noon". */
function clock(hhmm) {
  const [H, M] = hhmm.split(":").map(Number);
  if (H === 0 && M === 0) return "midnight";
  if (H === 12 && M === 0) return "noon";
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return h12 + (M ? ":" + String(M).padStart(2, "0") : "") + (H < 12 ? " a.m." : " p.m.");
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) + ", " + m[1] : "date not stated";
}
function dateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + ", " + clock(hh);
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
/* Ways a business can receive written orders. "prefill" means the link opens with the order
   already typed; otherwise the customer pastes the copied message. "direct" sends the order
   straight to the business's own open endpoint (for example a self-hosted ntfy topic). */
const CHANNELS = {
  demo: { label: "Demo order: nothing is sent, just for fun", icon: "send", direct: true },
  whatsapp: { label: "WhatsApp", icon: "chat", prefill: true, link: (id, text) => "https://wa.me/" + id + "?text=" + encodeURIComponent(text) },
  sms: { label: "Text message", icon: "sms", prefill: true, link: (id, text) => "sms:+" + id + "?body=" + encodeURIComponent(text) },
  email: { label: "Email", icon: "send", prefill: true, link: (id, text, code) => "mailto:" + id + "?subject=" + encodeURIComponent("Hana order " + (code || "")) + "&body=" + encodeURIComponent(text) },
  xmpp: { label: "XMPP", icon: "chat", prefill: true, link: (id, text) => "xmpp:" + id + "?message;body=" + encodeURIComponent(text) },
  matrix: { label: "Matrix", icon: "chat", prefill: false, link: (id) => "https://matrix.to/#/" + encodeURIComponent(id) },
  signal: { label: "Signal", icon: "chat", prefill: false, link: (id) => "https://signal.me/#p/+" + String(id).replace(/^\+/, "") },
  telegram: { label: "Telegram", icon: "send", prefill: false, link: (id) => "https://t.me/" + encodeURIComponent(id) },
  messenger: { label: "Messenger", icon: "chat", prefill: false, link: (id) => "https://m.me/" + encodeURIComponent(id) },
  hana: { label: "Send in Hana (recommended): the business replies here", icon: "send", prefill: true, direct: true, link: () => null },
  endpoint: { label: "Send directly to the business", icon: "send", prefill: true, direct: true, link: () => null },
  phone: { label: "Phone call", icon: "call", prefill: false, link: (id) => "tel:+" + id },
};
const CHANNEL_IDS_ARE_PHONES = ["whatsapp", "sms", "signal", "phone"];
const phoneText = (id) => "+" + String(id).replace(/^\+/, "");
function contactText(app, id) {
  if (CHANNEL_IDS_ARE_PHONES.includes(app)) return phoneText(id);
  if (app === "endpoint") { try { return new URL(id).host; } catch (e) { return id; } }
  return String(id);
}

/* Sends the order text straight to a business endpoint. A plain-text POST is a "simple"
   request, so open servers such as ntfy accept it without extra set-up. */
async function sendDirect(url, text) {
  if (!/^https:\/\//.test(url)) throw new Error("The address must start with https://");
  const r = await fetch(url, { method: "POST", body: text, headers: { "Content-Type": "text/plain;charset=utf-8" }, cache: "no-store" });
  if (!r.ok) throw new Error("The business's server answered " + r.status + ".");
}

/* ---------------------------------------------------------------- hashing, order check line (SPEC 6.4) */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.prototype.map.call(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function b32(bytes) {
  const bits = bytes.length * 8;
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  const pad = (5 - (bits % 5)) % 5;
  n <<= BigInt(pad);
  let out = "";
  for (let shift = bits + pad - 5; shift >= 0; shift -= 5) out += CROCKFORD[Number((n >> BigInt(shift)) & 31n)];
  return out;
}

async function checkCode(fullHash, zoneId, items, sub, fee) {
  const text = "hana1|" + fullHash + "|" + zoneId + "|" + items + "|" + sub + "|" + fee;
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return b32(d).slice(0, 8);
}

/* ---------------------------------------------------------------- fuzzy search (SPEC 5.1, Search) */

function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* Edit distance in which swapping two neighbouring letters counts as one edit. */
function editDistance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d.push([i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function wordMatches(q, w) {
  if (w.startsWith(q)) return true;
  const max = q.length <= 2 ? 0 : q.length <= 7 ? 1 : 2;
  if (!max) return false;
  for (const len of [q.length - 1, q.length, q.length + 1]) {
    if (len > 0 && editDistance(q, w.slice(0, len)) <= max) return true;
  }
  return false;
}

function fuzzyMatches(query, text) {
  const qs = norm(query).split(" ").filter(Boolean);
  if (!qs.length) return true;
  const words = norm(text).split(" ").filter(Boolean);
  return qs.every((q) => words.some((w) => wordMatches(q, w)));
}

/* ---------------------------------------------------------------- loading files */

/* Where data comes from. A hosted copy reads its own folder. A standalone copy (one HTML file
   kept offline, or a business's own site) carries a snapshot and refreshes from directory_url
   whenever it is online; the latest copy it fetched is kept on the device. */
const SNAP = (typeof window.HANA_SNAPSHOT === "object" && window.HANA_SNAPSHOT) || null;
const DATA_BASE = SNAP && SNAP.site && SNAP.site.directory_url ? SNAP.site.directory_url : new URL(".", document.baseURI).href;
function dataUrl(path) { return new URL(path, DATA_BASE).href; }

async function getText(path) {
  try {
    const r = await fetch(dataUrl(path), { cache: "no-cache" });
    if (!r.ok) throw new Error(String(r.status));
    const text = await r.text();
    if (SNAP) { try { localStorage.setItem("hana.data:" + path, text); } catch (e) { /* storage full: the snapshot still works */ } }
    return text;
  } catch (e) {
    /* The main copy is unreachable: try the mirrors listed in peers.json (remembered from the
       last successful visit). Menus are still checked against their hashes and signatures. */
    for (const base of store.get("hana.peers", [])) {
      try {
        const r = await fetch(new URL(path, base).href, { cache: "no-cache" });
        if (r.ok) return await r.text();
      } catch (x) { /* next mirror */ }
    }
    if (SNAP) {
      let cached = null;
      try { cached = localStorage.getItem("hana.data:" + path); } catch (x) { /* ignore */ }
      if (cached !== null) return cached;
      if (SNAP.files && typeof SNAP.files[path] === "string") return SNAP.files[path];
    }
    throw new Error(path + " could not be loaded");
  }
}
async function fetchJson(path) { return JSON.parse(await getText(path)); }
async function fetchBytes(path) { return utf8(await getText(path)); }

function priceLines(menu) {
  const out = [];
  for (const it of menu.items || []) {
    if (it.options) for (const op of it.options) out.push({ key: it.id + "." + op.id, item: it, label: it.name + " (" + op.label + ")", option: op.label, price: op.price });
    else out.push({ key: it.id, item: it, label: it.name, option: "", price: it.price });
  }
  return out;
}

/* ---------------------------------------------------------------- confirmations and signatures (SPEC 4.1, 6.5) */

const CHECK_LINE = /CHECK hana1 H=([0-9a-f]{12}) Z=([a-z0-9-]+) I=([a-z0-9.*,-]+) S=(\d+) F=(\d+|\?) C=([0-9A-HJKMNP-TV-Z]{8})/;
const CONFIRM_LINE = /CONFIRMED hana1 O=([0-9A-HJKMNP-TV-Z]{6}) C=([0-9A-HJKMNP-TV-Z]{8}) E=(\d{1,3}|\?) T=(\d{8,10}) K=([0-9a-f]{8}|-) S=([A-Za-z0-9_-]{86}|-)/;
const SIMPLE_CONFIRM = /CONFIRMED\s+([0-9A-HJKMNP-TV-Z]{6})\b/i;
const SIMPLE_DECLINE = /DECLINED\s+([0-9A-HJKMNP-TV-Z]{6})\b/i;
const unixMinutes = (d) => Math.floor((d ? new Date(d) : new Date()).getTime() / 60000);

function b64u(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(text) {
  const s = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(text).length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const utf8 = (s) => new TextEncoder().encode(s);
function confirmMessage(checkLine, orderCode, eta, minute) { return utf8("hana1-confirm|" + checkLine.trim() + "|" + orderCode + "|" + eta + "|" + minute); }
async function keyId(publicRaw) { return (await sha256Hex(publicRaw)).slice(0, 8); }

/* The same canonical JSON as tools/hana_sign.py: keys sorted, no spaces, "signature" left out. */
function canonicalJSON(value) {
  if (Array.isArray(value)) return "[" + value.map(canonicalJSON).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalJSON(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}
function menuSigningBytes(menu) {
  const body = Object.assign({}, menu);
  delete body.signature;
  return utf8(canonicalJSON(body));
}

/* Ed25519 through the Web Crypto API. Returns null when this browser cannot do Ed25519. */
async function ed25519Verify(publicRaw, message, signature) {
  try {
    const key = await crypto.subtle.importKey("raw", publicRaw, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, signature, message);
  } catch (e) { return null; }
}

/* Updates on an order sent in Hana (steps, chat, declines, cancellations) are signed: the
   business with its listing key, the customer with a key made for that one order. Neither side
   can later produce a message in the other's name, and a complaint summary carries the signed
   records so anyone can check them. See SPEC.md, section 21. */
function updateBytes(code, obj) {
  const b = JSON.parse(JSON.stringify(obj));
  delete b.sig;
  return utf8("hana-update-1\n" + code + "\n" + canonicalJSON(b));
}
async function signUpdate(privJwk, code, obj) {
  const priv = await crypto.subtle.importKey("jwk", Object.assign({ ext: true }, privJwk), { name: "Ed25519" }, false, ["sign"]);
  obj.sig = b64u(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, priv, updateBytes(code, obj))));
  return obj;
}
/* true (valid), false (missing or wrong) or null (this browser cannot check Ed25519). */
async function checkUpdate(publicB64, code, obj) {
  if (!publicB64 || !obj || typeof obj.sig !== "string") return false;
  try { return await ed25519Verify(unb64u(publicB64), updateBytes(code, obj), unb64u(obj.sig)); } catch (e) { return false; }
}
/* A signing key for one order, made by the customer's app. Null if the browser cannot make one. */
async function makeOrderKey() {
  try {
    const k = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const j = await crypto.subtle.exportKey("jwk", k.privateKey);
    return { jwk: { kty: "OKP", crv: "Ed25519", d: j.d, x: j.x }, pub: j.x };
  } catch (e) { return null; }
}

/* Reads a reply pasted by the customer. Returns {status, eta, line, minute} or {error}.
   status: "signed" (signature valid), "unsigned" (plain reply from a listing without a key),
   "unchecked" (this browser cannot check signatures) or "declined".
   windowMinutes: the business must confirm within this many minutes of the order (rules.json). */
async function readConfirmation(text, order, publicB64, windowMinutes) {
  const win = Number(windowMinutes) || 15;
  const created = unixMinutes(order.window_start || order.created || order.at);
  const decline = SIMPLE_DECLINE.exec(text || "");
  if (decline) {
    if (decline[1].toUpperCase() !== order.code) return { error: "This reply is for a different order." };
    return { status: "declined", eta: "?", line: decline[0], minute: unixMinutes() };
  }
  const full = CONFIRM_LINE.exec(text || "");
  if (full) {
    const check = CHECK_LINE.exec(order.check_line || "");
    if (full[1] !== order.code || !check || full[2] !== check[6]) return { error: "This confirmation is for a different order." };
    const minute = Number(full[4]);
    if (minute < created - 2) return { error: "This confirmation is dated before the order was prepared." };
    if (minute > created + win + 2) return { error: "The business confirmed after the " + win + "-minute limit, so the order had already been cancelled. Place a new order if you still want it." };
    if (full[5] === "-" && full[6] === "-") {
      if (order.claimed) return { error: "This business signs its confirmations. Ask it to reply using the Hana business tools." };
      return { status: "unsigned", eta: full[3], line: full[0], minute };
    }
    if (full[5] === "-" || full[6] === "-") return { error: "The confirmation is incomplete." };
    if (!publicB64) return { error: "The confirmation is signed, but this listing has no key to check it against." };
    let pub = null;
    for (const k of [publicB64].concat(order.staff_keys || [])) { const raw = unb64u(k); if ((await keyId(raw)) === full[5]) { pub = raw; break; } }
    if (!pub) return { error: "The confirmation was signed with a different key from the listing's." };
    const ok = await ed25519Verify(pub, confirmMessage(order.check_line, order.code, full[3], full[4]), unb64u(full[6]));
    if (ok === null) return { status: "unchecked", eta: full[3], line: full[0], minute };
    if (!ok) return { error: "The signature does not match. The confirmation was altered or did not come from the business." };
    return { status: "signed", eta: full[3], line: full[0], minute };
  }
  const simple = SIMPLE_CONFIRM.exec(text || "");
  if (simple) {
    if (simple[1].toUpperCase() !== order.code) return { error: "This confirmation is for a different order." };
    if (order.claimed) return { error: "This business signs its confirmations. Ask it to reply using the Hana business tools." };
    if (unixMinutes() > created + win + 2) return { error: "The " + win + "-minute limit for confirmation has passed, so the order was cancelled. If the business did reply in time, keep the chat as your record." };
    return { status: "unsigned", eta: "?", line: simple[0], minute: unixMinutes() };
  }
  return { error: "No confirmation found. Paste the business's reply, which contains CONFIRMED and your order code." };
}

/* ---------------------------------------------------------------- shared interface pieces */

let snackTimer = null;

/* A notice belongs to the page it was shown on. */
window.addEventListener("hashchange", () => { const s = document.getElementById("snackbar"); if (s) s.classList.remove("active"); clearTimeout(snackTimer); });
function snackbar(text) {
  const s = document.getElementById("snackbar");
  s.textContent = text;
  s.classList.add("active");
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => s.classList.remove("active"), 2500);
}

function ask(title, text, okLabel) {
  const d = document.getElementById("dialog");
  document.getElementById("dialog-title").textContent = title;
  document.getElementById("dialog-text").textContent = text;
  const ok = document.getElementById("dialog-ok");
  const cancel = document.getElementById("dialog-cancel");
  ok.textContent = okLabel || "OK";
  return new Promise((resolve) => {
    if (!d.showModal) { resolve(window.confirm(title + "\n\n" + text)); return; }
    const done = (v) => { d.close(); ok.onclick = cancel.onclick = null; d.oncancel = null; resolve(v); };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    d.oncancel = (e) => { e.preventDefault(); done(false); };
    d.showModal();
    cancel.focus();
  });
}

/* A notice card. tone: "info" (neutral) or "warn" (needs attention). */
function notice(tone, ...kids) {
  return h("article", { class: "round no-elevate " + (tone === "warn" ? "tertiary-container" : "surface-container-high"), role: tone === "warn" ? "note" : null },
    h("div", { class: "row top-align" }, icon(tone === "warn" ? "warning" : "info"), h("div", { class: "max" }, ...kids)));
}

function chip(text, tone) {
  const cls = tone === "ok" ? "primary-container" : tone === "warn" ? "tertiary-container" : "surface-container-highest";
  return h("span", { class: "chip small no-border " + cls }, text);
}

function sectionTitle(text) { return h("h2", { class: "section-title" }, text); }
/* ---------------------------------------------------------------- app icon */

/* The person can choose the app icon's background colour. The icon is drawn on the
   device, then used for the browser tab, for Add to Home Screen and in a manifest written on the
   device. The standard icon (the files in the repository) is used until something is changed. */
const ICON_BGS = [["#0F766E", "Teal"], ["#F7F5F2", "Rice paper"], ["#40E0D0", "Turquoise"], ["#9A3412", "Clay"], ["#3730A3", "Indigo"],
  ["#15803D", "Green"], ["#7E22CE", "Plum"], ["#FACC15", "Yellow"], ["#111827", "Black"]];
const ICON_DEFAULT = { bg: "#0F766E" };
function iconChoice() { return Object.assign({}, ICON_DEFAULT, store.get("hana.icon", {})); }
/* The logo (logo.svg, the smiling rice ball) drawn on the chosen background. */
let logoImage = null;
function loadLogo() {
  if (logoImage) return logoImage;
  const brand = document.querySelector("img.brand-mark");
  logoImage = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = brand ? brand.src : "logo.svg"; });
  return logoImage;
}
async function drawIcon(size, frac, radius, choice) {
  const img = await loadLogo();
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = /^#[0-9a-f]{6}$/i.test(choice.bg) ? choice.bg : ICON_DEFAULT.bg;
  if (radius && g.roundRect) { g.beginPath(); g.roundRect(0, 0, size, size, radius); g.fill(); } else g.fillRect(0, 0, size, size);
  const w = size * frac;
  g.drawImage(img, (size - w) / 2, (size - w) / 2, w, w);
  return c.toDataURL("image/png");
}
function setLink(rel, href, extra) {
  let l = document.querySelector('link[rel="' + rel + '"]' + (extra || ""));
  if (!l) { l = document.createElement("link"); l.rel = rel; document.head.append(l); }
  l.href = href;
}
async function applyIcon() {
  const ch = iconChoice();
  if (ch.bg.toUpperCase() === ICON_DEFAULT.bg) return;
  try {
    setLink("icon", await drawIcon(64, 0.9, 14, ch), '[type="image/svg+xml"]');
    setLink("icon", await drawIcon(32, 0.94, 7, ch), '[sizes="32x32"]');
    setLink("apple-touch-icon", await drawIcon(180, 0.86, 0, ch));
    const base = new URL(".", document.baseURI).href;
    const manifest = {
      id: base, name: "Hana", short_name: "Hana", start_url: base, scope: base, display: "standalone",
      description: "Food and groceries in Chittagong. A free, open directory that prepares your orders. Pay on delivery.",
      background_color: ch.bg, theme_color: "#9a3412",
      icons: [{ src: await drawIcon(192, 0.86, 0, ch), sizes: "192x192", type: "image/png", purpose: "any" },
        { src: await drawIcon(512, 0.86, 0, ch), sizes: "512x512", type: "image/png", purpose: "any" },
        { src: await drawIcon(512, 0.62, 0, ch), sizes: "512x512", type: "image/png", purpose: "maskable" }],
    };
    setLink("manifest", "data:application/manifest+json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifest)));
  } catch (e) { /* the standard icon stays */ }
}

/* ---------------------------------------------------------------- installing the app */

/* Browsers decide for themselves whether to offer installation, and most never show a pop-up:
   Chrome and Edge keep the offer until the page asks, and Safari and Firefox have none. So Hana
   keeps the offer when there is one and otherwise explains the browser's own steps. */
let installOffer = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installOffer = e; document.dispatchEvent(new Event("hana-install")); });
window.addEventListener("appinstalled", () => { installOffer = null; document.dispatchEvent(new Event("hana-install")); snackbar("Hana is installed. Open it from your home screen or app list."); });
function isInstalled() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
function installSteps() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return "Tap the Share button, then Add to Home Screen. On an iPad, the Share button is at the top of the screen.";
  if (/Android/.test(ua)) {
    if (/Firefox/.test(ua)) return "Open the menu (the three dots), then Install.";
    if (/SamsungBrowser/.test(ua)) return "Open the menu (the three lines), then Add page to, then Home screen.";
    return "Open the browser menu (the three dots), then Add to Home screen or Install app.";
  }
  if (/Firefox/.test(ua)) return "Firefox on computers cannot install web apps. Use Chrome, Edge or Safari, or download the offline copy in Settings.";
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return "In the menu bar, choose File, then Add to Dock.";
  return "Click the install button at the right end of the address bar, or open the browser menu and choose Install Hana (in Chrome: Cast, save and share, then Install page as app).";
}
async function installApp() {
  if (installOffer) {
    const offer = installOffer;
    offer.prompt();
    const choice = await offer.userChoice.catch(() => null);
    installOffer = null;
    if (choice && choice.outcome !== "accepted") snackbar("Not installed. You can install Hana later from Settings.");
    return;
  }
  await ask("Install Hana", installSteps(), "OK");
}
/* A short card offering installation. dismissible: shows "Not now", remembered on this device. */
function installCard(dismissible) {
  if (isInstalled() || (dismissible && store.get("hana.install.dismissed", false))) return null;
  const card = notice("info", h("p", { class: "bold flush" }, "Install Hana"),
    h("p", { class: "flush" }, "Open it from your home screen like any other app. It works offline and needs no app store."),
    h("nav", { class: "wrap small-space gap-top" },
      h("button", { type: "button", on: { click: installApp } }, icon("download"), h("span", null, "Install")),
      dismissible ? h("button", { type: "button", class: "border", on: { click: () => { store.set("hana.install.dismissed", true); card.remove(); } } }, h("span", null, "Not now")) : null));
  return card;
}

/* In-app chat for an open order sent in Hana (both sides). Messages are sealed on the order's
   own topic and kept on each device with the order. */
function chatBox(messages, mine, quick, onSend) {
  const list = h("ul", { class: "list border chat-list" }, (messages || []).map((m) => h("li", { class: m.from === mine ? "chat-mine" : "chat-theirs" },
    h("div", { class: "max" }, h("div", null, m.text), h("div", { class: "small-text muted" }, (m.from === mine ? "You" : mine === "c" ? "Business" : "Customer") + " · " + dateTime(m.at) + (m.from !== mine && m.verified === false ? " · not verified" : ""))))));
  const box = h("input", { type: "text", maxlength: 300, placeholder: " ", id: "chat-" + Math.random().toString(36).slice(2) });
  const send = async (text) => { text = String(text || "").trim(); if (!text) return; box.value = ""; await onSend(text); };
  return h("div", { class: "stack" },
    messages && messages.length ? list : h("p", { class: "small-text muted flush" }, "No messages yet."),
    h("nav", { class: "wrap small-space" }, quick.map((q) => h("button", { type: "button", class: "chip small border", on: { click: () => send(q) } }, q))),
    h("div", { class: "field-row" }, textField(box.id, "Message", box), h("button", { type: "button", class: "circle", "aria-label": "Send message", on: { click: () => send(box.value) } }, icon("send"))));
}

function pageTitle(text) { return h("h1", { class: "page-title" }, text); }

/* In-app history, so Back returns to the page the person came from, and a page opened
   directly (from a link or bookmark) still has a sensible place to go back to. */
const trail = [];
function trackPage() {
  const now = location.hash || "#/";
  if (trail.length > 1 && trail[trail.length - 2] === now) trail.pop();
  else if (trail[trail.length - 1] !== now) trail.push(now);
  const s = document.getElementById("settings-link");
  if (s) { if (now === "#/settings") s.setAttribute("aria-current", "page"); else s.removeAttribute("aria-current"); }
}
function goBack(fallback) {
  if (trail.length > 1) history.back();
  else location.hash = fallback || "#/";
}
/* Title row with a Back button, for every page that is not one of the main tabs. */
function pageHeader(title, fallback) {
  return h("nav", { class: "page-head" },
    h("button", { type: "button", class: "circle transparent", "aria-label": "Back", title: "Back", on: { click: () => goBack(fallback) } }, icon("arrow_back")),
    h("h1", { class: "page-title max" }, title));
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
  const back = document.querySelector("main .page-head > button");
  if (back) back.click();
});
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("#settings-link");
  if (a && (location.hash === "#/settings")) { e.preventDefault(); goBack("#/"); }
});

function textField(id, label, input) {
  return h("div", { class: "field-wrap" },
    h("label", { for: id, class: "field-label" }, label),
    h("div", { class: "field border round" + (input.tagName === "TEXTAREA" ? " textarea" : "") }, input));
}

/* Renders the small subset of Markdown used in TERMS.md as plain elements (text only, never HTML). */
function renderMarkdown(text) {
  const nodes = [];
  let list = null;
  const inline = (s) => s.replace(/\*\*/g, "").replace(/`/g, "");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { list = null; continue; }
    let m;
    if ((m = /^# (.+)/.exec(line))) { nodes.push(pageTitle(inline(m[1]))); list = null; }
    else if ((m = /^## (.+)/.exec(line))) { nodes.push(sectionTitle(inline(m[1]))); list = null; }
    else if ((m = /^- (.+)/.exec(line))) { if (!list || list.tagName !== "UL") { list = h("ul"); nodes.push(list); } list.append(h("li", null, inline(m[1]))); }
    else if ((m = /^\d+\. (.+)/.exec(line))) { if (!list || list.tagName !== "OL") { list = h("ol"); nodes.push(list); } list.append(h("li", null, inline(m[1]))); }
    else { nodes.push(h("p", null, inline(line))); list = null; }
  }
  return nodes;
}

/* Labels sit above their fields, never inside them, so a long label or large text wraps instead of being cut off. */
/* An x button that empties a search box and puts the cursor back in it. */
function clearButton(input) {
  const b = h("button", { type: "button", class: "circle transparent small clear-search", "aria-label": "Clear the search", hidden: !input.value,
    on: { pointerdown: (e) => e.preventDefault(), click: () => { input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); } } }, icon("close"));
  input.addEventListener("input", () => { b.hidden = !input.value; });
  return b;
}
function selectField(id, label, selectEl) {
  return h("div", { class: "field-wrap" },
    h("label", { for: id, class: "field-label" }, label),
    h("div", { class: "field suffix border round" }, selectEl, icon("arrow_drop_down")));
}

function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => snackbar("Copied."), () => snackbar("Could not copy. Select the text and copy it manually."));
  else snackbar("Could not copy. Select the text and copy it manually.");
}


/* ---------------------------------------------------------------- updates and offline use */

/* True while the person is typing something that a reload would lose. */
function busyTyping() {
  return Array.from(document.querySelectorAll("main input, main textarea"))
    .some((el) => el.type !== "radio" && el.type !== "checkbox" && el.type !== "file" && el.value && el.value !== el.defaultValue);
}

function applyUpdate() {
  if (busyTyping()) { snackbar("A new version of Hana is ready. It loads the next time you open this page."); return; }
  location.reload();
}

/* The service worker keeps a copy for offline use and always asks the server for the newest
   files first. While a page stays open, the code files are also checked whenever the page
   comes back into view, so a release reaches people without clearing anything. */
function setupUpdates(files) {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    applyUpdate();
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .then((reg) => { reg.update(); return reg; })
    .then((reg) => {
      const fingerprint = () => Promise.all(files.map((f) => fetch(f, { cache: "no-cache" }).then((r) => r.ok ? r.arrayBuffer() : new ArrayBuffer(0)).then((b) => sha256Hex(new Uint8Array(b)))))
        .then((hs) => hs.join(""));
      let known = null;
      /* Taken a few seconds after start-up so it does not compete with the page loading. */
      setTimeout(() => fingerprint().then((f) => { known = f; }).catch(() => {}), 4000);
      const check = () => {
        if (document.visibilityState !== "visible" || known === null) return;
        reg.update();
        fingerprint().then((f) => { if (f !== known) { known = f; applyUpdate(); } }).catch(() => {});
      };
      document.addEventListener("visibilitychange", check);
      setInterval(check, 30 * 60 * 1000);
    })
    .catch(() => { /* the page still works online without the service worker */ });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* ---------------------------------------------------------------- pictures */

/* Pictures come only from these hosts (rules.json image_hosts), over https, as JPEG, PNG,
   WebP or AVIF. They are shown with <img>, which never runs code, and the page's Content
   Security Policy blocks every other image host. */
let IMAGE_HOSTS = ["upload.wikimedia.org", "raw.githubusercontent.com", "codeberg.org", "gitlab.com", "i.ibb.co"];
function safeImageUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && IMAGE_HOSTS.includes(x.hostname) && /\.(jpe?g|png|webp|avif)$/i.test(x.pathname) ? x.href : null;
  } catch (e) { return null; }
}

/* Default covers: one openly licensed photo of plated restaurant food per cuisine, hot-linked
   from Wikimedia Commons. No searching, so no request is made until a cover scrolls into
   view. A business's own cover always takes priority. "path" is Commons' storage folder. */
const COVERS = {
  south_asian: { file: "Indian-Food-wikicont.jpg", path: "c/c1", credit: "South Asian food" },
  bangladeshi: { file: "Bangladeshi_Prawn_Curry.jpg", path: "3/3f", credit: "Prawn curry, by Jubair Bin Iqbal, CC BY-SA" },
  pizza: { file: "Eq_it-na_pizza-margherita_sep2005_sml.jpg", path: "a/a3", credit: "Pizza margherita, by Valerio Capello" },
  fried_chicken: { file: "Fried-Chicken-Set.jpg", path: "2/2c", credit: "Fried chicken" },
  burger: { file: "NCI_Visuals_Food_Hamburger.jpg", path: "6/62", credit: "Hamburger, by Renee Comet, public domain" },
  chinese: { file: "Chinese_meal.jpg", path: "1/14", credit: "Chinese meal, by ZiCheng Xu, CC BY-SA" },
  coffee: { file: "Masala_Tea_-_2.jpg", path: "d/d7", credit: "Masala tea, by Sarkar Sayantan, CC BY-SA 4.0" },
  grocery: { file: "BD_Mohanganj_7.jpg", path: "a/a8", credit: "Rice shop in Mohanganj, Bangladesh" },
};
/* Food categories: used for search, section tabs, cuisine covers and item drawings.
   [key, label, icon in icons/food.svg, words that place a dish in it]. Order matters: the first match wins. */
const FOOD = [
  ["pizza", "Pizza", "pizza", /pizza/i],
  ["burger", "Burgers", "burger", /burger/i],
  ["fried_chicken", "Fried chicken", "chicken", /fried chicken|wings?\b|popcorn|strips?\b|drumstick|nugget|broast|crispy chicken/i],
  ["biryani", "Biryani", "biryani", /biryani|biriyani|kacchi|tehari|polao|pulao/i],
  ["bangladeshi", "Bangladeshi", "rice", /bangla|bengali|bhuna|bhorta|vorta|mezban|khichuri|bhaji|bhat\b/i],
  ["south_asian", "South Asian", "curry", /south asian|india|pakistan|nepal|tandoor|tikka masala|masala|curry|naan|paneer|korma|butter chicken|\bdal\b|dahi|chaat/i],
  ["chinese", "Chinese and Thai", "noodles", /chinese|thai|chow ?mein|noodle|fried rice|dim ?sum|dumpling|wonton|szechuan|ramen|manchurian/i],
  ["pasta", "Pasta", "pasta", /pasta|spaghetti|lasagn|penne|fettuccine|macaroni|carbonara/i],
  ["kebab", "Kebabs and grills", "kebab", /kebab|kabab|grill|bbq|shashlik|steak|chaap|tikka|meat box/i],
  ["wrap", "Sandwiches and wraps", "sandwich", /sandwich|\bsub\b|wrap|shawarma|club|hot ?dog|roll\b/i],
  ["seafood", "Seafood", "seafood", /prawn|shrimp|fish|seafood|crab|calamari|squid/i],
  ["salad", "Salads", "salad", /salad/i],
  ["soup", "Soups", "soup", /soup/i],
  ["sides", "Fries and sides", "fries", /fries|wedges|\bsides?\b|nachos|add-?ons?|dip\b|sauce/i],
  ["dessert", "Desserts", "cake", /dessert|cake|brownie|ice ?cream|pudding|firni|sweet|mishti|halwa|kulfi|waffle|pastry|doughnut|donut/i],
  ["coffee", "Coffee and tea", "coffee", /coffee|\btea\b|latte|cappuccino|espresso|chai|mocha/i],
  ["drink", "Drinks", "drink", /drink|juice|lassi|shake|soda|cola|smoothie|mojito|lemonade|water|beverage/i],
  ["breakfast", "Breakfast", "breakfast", /breakfast|paratha|porota|\beggs?\b|omelette/i],
  ["combo", "Combos and platters", "combo", /combo|platter|set menu|meal box|family pack/i],
];
/* Grocery stores sort their products into these instead. */
const GROCERY = [
  ["produce", "Fruit and vegetables", "produce", /vegetable|fruit|potato|onion|tomato|banana|apple|mango|orange|greens|\bshak\b|chilli|chili|garlic|ginger|lemon|cucumber|carrot/i],
  ["meat_fish", "Meat and fish", "fish", /beef|mutton|chicken|fish|prawn|shrimp|meat|hilsa|ilish|rui\b/i],
  ["dairy", "Dairy and eggs", "dairy", /milk|\beggs?\b|butter|cheese|yogh?urt|\bdoi\b|ghee|cream/i],
  ["bakery", "Bread and bakery", "bakery", /bread|\bbuns?\b|cake|rusk|toast/i],
  ["staples", "Rice, flour and lentils", "rice", /rice|\bchal\b|flour|atta|maida|lentil|\bdal\b|sugar|\bsalt\b|semolina|suji/i],
  ["oil_spices", "Oil and spices", "spices", /\boil\b|spice|masala|turmeric|cumin|chilli powder|pepper|coriander/i],
  ["snacks", "Snacks", "snacks", /snack|chips|chanachur|noodles|chocolate|biscuit|cookie/i],
  ["drink", "Drinks", "drink", /water|juice|soda|\btea\b|coffee|drink|cola/i],
  ["household", "Household and cleaning", "household", /soap|detergent|clean|tissue|toilet|dishwash|shampoo|toothpaste/i],
  ["baby", "Baby care", "baby", /baby|diaper|nappy|formula/i],
];
const FOOD_BY_KEY = Object.fromEntries(GROCERY.concat([["grocery", "Groceries", "grocery", /grocery|supermarket|super ?shop/i]], FOOD).map((f) => [f[0], f]));
function isGrocery(m) { return !!m && /grocery|supermarket|super ?shop|convenience/i.test(m.kind || ""); }
const COVER_OF = { biryani: "bangladeshi" };
function foodCat(text, list) { for (const f of list || FOOD) if (text && f[3].test(text)) return f[0]; return null; }
function itemCat(it, m) { const l = isGrocery(m) ? GROCERY : FOOD; return foodCat(it.category, l) || foodCat(it.name, l) || foodCat(it.section, l); }
function cuisineKey(m) {
  if (m.cuisine_key !== undefined) return m.cuisine_key;
  if (isGrocery(m)) return "grocery";
  const own = foodCat(m.cuisine);
  if (own) return own;
  const score = {};
  for (const it of m.items || []) { const k = foodCat(it.section) || itemCat(it); if (k && k !== "sides" && k !== "drink") score[k] = (score[k] || 0) + 1; }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}
/* The food icons are Twemoji graphics (CC BY 4.0), kept in one file in this repository. */
const FOOD_SPRITE = SNAP ? "" : "icons/food.svg";
function foodIcon(key, cls) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "food-icon" + (cls ? " " + cls : ""));
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVGNS, "use");
  use.setAttribute("href", FOOD_SPRITE + "#" + ((FOOD_BY_KEY[key] || [])[2] || key || "plate"));
  svg.append(use);
  return svg;
}
function coverFor(m) {
  if (m.cover && safeImageUrl(m.cover.src)) return { src: safeImageUrl(m.cover.src), credit: m.cover.credit ? String(m.cover.credit).slice(0, 120) : "Photo supplied by the business" };
  const k = cuisineKey(m);
  const c = COVERS[COVER_OF[k] || k];
  if (!c) return null;
  const f = encodeURIComponent(c.file), base = "https://upload.wikimedia.org/wikipedia/commons/";
  return { src: base + "thumb/" + c.path + "/" + f + "/960px-" + f, fallback: base + c.path + "/" + f,
    credit: "Stock photo: " + c.credit + ", Wikimedia Commons", page: "https://commons.wikimedia.org/wiki/File:" + f };
}

/* Shown where no picture has been supplied: the food icon for the dish or cuisine. */
function placeholder(cls, key) { return h("div", { class: cls + " placeholder", role: "presentation" }, foodIcon(key || "plate")); }

/* A picture that loads only when it nears the screen. Falls back to the original file, then
   to the drawing, so a missing or blocked picture never leaves a gap. */
function picture(info, cls, alt, key) {
  if (!info || !settings().pictures) return placeholder(cls, key);
  let triedFallback = !info.fallback;
  const img = h("img", { src: info.src, alt: alt || "", class: cls, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer",
    on: { error: () => {
      if (!triedFallback) { triedFallback = true; img.src = info.fallback; return; }
      img.replaceWith(placeholder(cls, key));
    } } });
  return img;
}
function itemPicture(it, m) { const k = itemCat(it, m); return it.image && safeImageUrl(it.image.src) ? picture({ src: safeImageUrl(it.image.src) }, "thumb", "", k) : placeholder("thumb", k); }

/* Clears the picture search results that earlier versions stored. */
try { Object.keys(localStorage).filter((k) => k.startsWith("hana.img:")).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }

/* ---------------------------------------------------------------- standalone copy */

/* Builds one HTML file containing the app, its styles and a snapshot of the directory.
   Opened from a phone's files or put on any web host, it works offline and refreshes from
   directory_url when online. mode "business" shows one listing, with the Hana credit. */
async function buildStandalone(opts) {
  const fetchText = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " could not be loaded"); return r.text(); });
  const [page, coreJs, appJs, beer, theme, bookJs, directJs, fontBuf] = await Promise.all(["index.html", "core.js", "app.js", "theme/beer.min.css", "theme/theme.css", "phonebook.js", "direct.js"].map(fetchText)
    .concat([fetch("theme/material-symbols-subset.woff2").then((r) => r.arrayBuffer())]));
  const sprite = (await fetchText("icons/food.svg")).replace("<svg ", "<svg hidden ");
  const logoUri = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(await fetchText("logo.svg"))));
  const fontB64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(fontBuf))));
  const files = {};
  for (const f of ["rules.json", "areas.json", "index.json", "list.json", "search.json", "TERMS.md"]) files[f] = await getText(f);
  const index = JSON.parse(files["index.json"]);
  /* Every copy carries the whole directory, so each one is also a backup of it. A business
     site opens on its own listing. */
  if (opts.mode === "business" && !index.restaurants.some((r) => r.id === opts.listingId)) throw new Error("That listing is not in the directory yet.");
  for (const r of index.restaurants) for (const loc of r.locations || []) { try { files[loc] = await getText(loc); break; } catch (e) { /* next */ } }
  const directory = SNAP ? DATA_BASE : new URL(".", document.baseURI).href;
  const site = { repo_url: (opts.site && opts.site.repo_url) || "", company_url: "https://hamidyasir.com", directory_url: directory,
    main_app_url: (SNAP && SNAP.site.main_app_url) || directory, mode: opts.mode || "directory", listing_id: opts.listingId || null };
  const snapshot = { built: new Date().toISOString(), site, files };
  const esc = (s) => s.replace(/<\/(script)/gi, "<\\/$1");
  const snapJs = "window.HANA_SNAPSHOT=" + JSON.stringify(snapshot).replace(/</g, "\\u003c") + ";";
  const css = beer + "\n" + theme.replace("url(material-symbols-subset.woff2)", "url(data:font/woff2;base64," + fontB64 + ")");
  const hash = async (s) => "'sha256-" + btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(s)))))) + "'";
  const scripts = [snapJs, esc(coreJs), esc(directJs), esc(appJs), esc(bookJs)];
  const csp = "default-src 'none'; img-src 'self' data: blob: https://upload.wikimedia.org https://raw.githubusercontent.com https://codeberg.org https://gitlab.com https://i.ibb.co https://tile.openstreetmap.org; " +
    "connect-src https:; font-src data:; style-src " + (await hash(css)) + "; script-src " + (await Promise.all(scripts.map(hash))).join(" ") + "; base-uri 'none'; form-action 'none'";
  let html = page
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
    .replace(/<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\n?/g, "")
    .replace('<link rel="stylesheet" href="theme/beer.min.css">\n<link rel="stylesheet" href="theme/theme.css">', () => "<style>" + css + "</style>")
    .replace('<script src="core.js" defer></script>\n<script src="direct.js" defer></script>\n<script src="app.js" defer></script>', () => scripts.map((s) => "<script>" + s + "</script>").join("\n"))
    .replace('<header class="responsive">', () => sprite + '\n<header class="responsive">')
    .replace('src="logo.svg"', () => 'src="' + logoUri + '"')
    .replace(/{{REPO_URL}}/g, site.repo_url || "#");
  return html;
}

/* ---------------------------------------------------------------- opening hours */

function hhmmToMin(hhmm) { const p = hhmm.split(":"); return Number(p[0]) * 60 + Number(p[1]); }
/* The next moment the business opens, from "when" (a Date), within 7 days; null if never. */
function nextOpening(hours, when) {
  if (!hours) return null;
  const DAYKEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const start = when || new Date();
  for (let d = 0; d <= 7; d++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
    const spans = (hours[DAYKEYS[(day.getDay() + 6) % 7]] || []).slice().sort((a, b) => hhmmToMin(a[0]) - hhmmToMin(b[0]));
    for (const [s] of spans) {
      const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(hhmmToMin(s) / 60), hhmmToMin(s) % 60);
      if (t > start) return t;
    }
  }
  return null;
}

setupThemeToggle();

/* When a listing's prices were last confirmed: the explicit prices_confirmed_at (set when a
   price changes or the owner reconfirms them), else the latest price-history entry with a real
   price or fee change, else the first publication. A menu edit that changes no price does not
   count. tools/build_list.py works this out the same way for list.json. */
function pricesConfirmedAt(m) {
  if (!m) return null;
  if (m.prices_confirmed_at) return m.prices_confirmed_at;
  const changed = (m.price_history || []).filter((e) => e && Array.isArray(e.changes) && e.changes.length && e.published);
  if (changed.length) return changed[changed.length - 1].published;
  if ((m.price_history || []).length === 0 || m.version === 1) return (m.announcement && m.announcement.published) || null;
  return null;
}

/* Bangla: a small word list (i18n/bn.json), loaded only when chosen, replaces the interface's
   fixed labels as they appear. Business names, dishes and order messages stay as written. */
function language() { try { return localStorage.getItem("hana.lang") === "bn" ? "bn" : "en"; } catch (e) { return "en"; } }
function setLanguage(l) { try { localStorage.setItem("hana.lang", l); } catch (e) { /* ignore */ } location.reload(); }
(async function startLanguage() {
  if (language() !== "bn" || !document.body) return;
  let T;
  try { T = await (await fetch("i18n/bn.json")).json(); } catch (e) { return; }
  document.documentElement.lang = "bn";
  const one = (n) => { const k = n.nodeValue.trim(); if (k && T[k]) n.nodeValue = n.nodeValue.replace(k, T[k]); };
  const all = (root) => {
    if (root.nodeType === 3) { one(root); return; }
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) one(w.currentNode);
    for (const el of [root].concat(Array.from(root.querySelectorAll("[aria-label],[placeholder],[title]")))) {
      for (const a of ["aria-label", "placeholder", "title"]) { const v = el.getAttribute && el.getAttribute(a); if (v && T[v.trim()]) el.setAttribute(a, T[v.trim()]); }
    }
  };
  all(document.body);
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") one(m.target); else m.addedNodes.forEach(all); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
})();
